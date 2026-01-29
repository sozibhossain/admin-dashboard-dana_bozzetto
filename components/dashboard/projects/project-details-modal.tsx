"use client";

import React from "react";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { projectsAPI, documentsAPI, chatsAPI } from "@/lib/api";
import { toast } from "sonner";
import { X, Plus, Eye, Edit2, Trash2, Upload, FileText } from "lucide-react";
import EditTaskModal from "./edit-task-modal";
import AddTaskModal from "./add-task-modal";
import DeleteConfirmDialog from "@/components/dashboard/delete-confirm-dialog";
import { useSession } from "next-auth/react";

interface ProjectDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string | null;
}

type ProjectDetails = {
  _id: string;
  projectNo?: string;
  name: string;
  description?: string;
  status?: string;
  budget: number;
  startDate: string;
  endDate: string;
  client?: { name?: string; email?: string };
  teamMembers?: {
    user: { _id: string; name: string; avatar?: { url?: string } };
    role: string;
  }[];
  milestones?: { _id: string; name: string; status: string }[];
  tasks?: any[];
  documents?: any[];
  financials?: { totalBudget: number; totalPaid: number; totalUnpaid: number };
};

export default function ProjectDetailsModal({ isOpen, onClose, projectId }: ProjectDetailsModalProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState("team");
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [isAddMilestoneOpen, setIsAddMilestoneOpen] = useState(false);
  const [isUploadDocsOpen, setIsUploadDocsOpen] = useState(false);
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<any | null>(null);
  const [previewTask, setPreviewTask] = useState<any | null>(null);
  const [previewTaskDoc, setPreviewTaskDoc] = useState<any | null>(null);
  const [editingTask, setEditingTask] = useState<any | null>(null);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["project", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const res = await projectsAPI.getById(projectId as string);
      return res.data as ProjectDetails;
    },
  });

  const { data: teamMembersData = [] } = useQuery({
    queryKey: ["team-members", "all"],
    queryFn: async () => {
      const res = await projectsAPI.getTeamMembers();
      return res.data as any[];
    },
    enabled: isAddMemberOpen,
  });

  const milestoneMap = useMemo(() => {
    const map: Record<string, string> = {};
    (data?.milestones || []).forEach((m) => {
      map[m._id] = m.name;
    });
    return map;
  }, [data?.milestones]);

  const tasks = data?.tasks || [];
  const documents = data?.documents || [];

  const addMemberMutation = useMutation({
    mutationFn: (payload: { userId: string; role?: string }) =>
      projectsAPI.addTeamMember(projectId as string, payload),
    onSuccess: () => {
      toast.success("Team member added");
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      setIsAddMemberOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to add member");
    },
  });

  const addMilestoneMutation = useMutation({
    mutationFn: (name: string) =>
      projectsAPI.addMilestone(projectId as string, { name }),
    onSuccess: () => {
      toast.success("Milestone added");
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      setIsAddMilestoneOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to add milestone");
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (taskId: string) => projectsAPI.deleteTask(taskId),
    onSuccess: () => {
      toast.success("Task deleted");
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      setDeletingTaskId(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to delete task");
    },
  });

  const accessChatMutation = useMutation({
    mutationFn: (payload: { userId: string; projectId: string }) =>
      chatsAPI.access(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chats"] });
    },
  });

  const handleClose = () => {
    onClose();
    setActiveTab("team");
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-white/10 backdrop-blur-2xl border border-white/20 text-white sm:max-w-6xl">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="text-2xl font-bold text-white">
                {data?.name || "Project Details"}
              </DialogTitle>
              <p className="text-slate-200 text-sm">
                {data?.client?.name ? `Client: ${data.client.name}` : "Client information"}
              </p>
            </div>
            <button onClick={handleClose} className="p-2 text-slate-200 hover:text-white rounded">
              <X className="w-5 h-5" />
            </button>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="py-10 text-center text-slate-200">Loading project...</div>
        ) : isError || !data ? (
          <div className="py-10 text-center text-red-200">Failed to load project</div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm text-slate-200">
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <p className="text-xs text-slate-300">Start Date</p>
                <p className="font-semibold">{new Date(data.startDate).toLocaleDateString()}</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <p className="text-xs text-slate-300">End Date</p>
                <p className="font-semibold">{new Date(data.endDate).toLocaleDateString()}</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <p className="text-xs text-slate-300">Total Budget</p>
                <p className="font-semibold">
                  ${(data.financials?.totalBudget || data.budget).toLocaleString()}
                </p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <p className="text-xs text-slate-300">Total Paid</p>
                <p className="font-semibold">${(data.financials?.totalPaid || 0).toLocaleString()}</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <p className="text-xs text-slate-300">Total Unpaid</p>
                <p className="font-semibold">${(data.financials?.totalUnpaid || 0).toLocaleString()}</p>
              </div>
            </div>

            {data.description && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-slate-200">
                <p className="text-xs uppercase text-slate-400 mb-2">Project Description</p>
                <p className="text-sm">{data.description}</p>
              </div>
            )}

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="bg-white/5 border border-white/10">
                <TabsTrigger value="team">Team</TabsTrigger>
                <TabsTrigger value="milestones">Milestones</TabsTrigger>
                <TabsTrigger value="tasks">Tasks</TabsTrigger>
                <TabsTrigger value="documents">Documents</TabsTrigger>
              </TabsList>

              <TabsContent value="team" className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Assign Your Team</h3>
                  <Button
                    className="bg-teal-600 hover:bg-teal-700 text-white"
                    onClick={() => setIsAddMemberOpen(true)}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Member
                  </Button>
                </div>
                {(data.teamMembers || []).length === 0 ? (
                  <div className="text-slate-300">No team members assigned.</div>
                ) : (
                  <div className="space-y-2">
                    {data.teamMembers?.map((member) => (
                      <div
                        key={member.user._id}
                        className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-4 py-3"
                      >
                        <div className="flex items-center gap-3">
                          <img
                            src={member.user.avatar?.url || "/placeholder.svg"}
                            className="w-9 h-9 rounded-full"
                            alt={member.user.name}
                          />
                          <div>
                            <p className="font-medium">{member.user.name}</p>
                            <p className="text-xs text-slate-300">{member.role}</p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          className="bg-white/10 hover:bg-white/20 text-white"
                          onClick={async () => {
                            if (!data?._id) return;
                            if (!member?.user?._id) return;
                            if (!session?.user?.id) {
                              toast.error("Please sign in to start a chat");
                              return;
                            }
                            if (member.user._id === session.user.id) {
                              toast.info("You cannot start a chat with yourself");
                              return;
                            }

                            try {
                              const res = await accessChatMutation.mutateAsync({
                                userId: member.user._id,
                                projectId: data._id,
                              });
                              const chatId = res?.data?._id;
                              if (chatId) {
                                router.push(`/dashboard/messages?chatId=${chatId}`);
                                handleClose();
                              } else {
                                toast.error("Chat could not be created");
                              }
                            } catch (error: any) {
                              toast.error(error.response?.data?.message || "Failed to start chat");
                            }
                          }}
                        >
                          Message
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="milestones" className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Project Milestones</h3>
                  <Button
                    className="bg-teal-600 hover:bg-teal-700 text-white"
                    onClick={() => setIsAddMilestoneOpen(true)}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add New Milestone
                  </Button>
                </div>
                <div className="space-y-3">
                  {data.milestones?.map((milestone) => (
                    <div
                      key={milestone._id}
                      className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-4 py-3"
                    >
                      <div>
                        <p className="font-medium">{milestone.name}</p>
                        <p className="text-xs text-slate-300">Status: {milestone.status}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          className="bg-white/10 hover:bg-white/20 text-white"
                          onClick={() => setIsUploadDocsOpen(true)}
                        >
                          Upload Documents
                        </Button>
                        <Button
                          variant="ghost"
                          className="bg-white/10 hover:bg-white/20 text-white"
                          onClick={() => {
                            const doc = documents.find((d: any) => d.milestoneId === milestone._id);
                            if (doc) setPreviewDoc(doc);
                            else toast.info("No documents for this milestone yet");
                          }}
                        >
                          View Documents
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="tasks" className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Project Tasks</h3>
                  <Button
                    className="bg-teal-600 hover:bg-teal-700 text-white"
                    onClick={() => setIsAddTaskOpen(true)}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add New Task
                  </Button>
                </div>
                {tasks.length === 0 ? (
                  <div className="text-slate-300">No tasks found.</div>
                ) : (
                  <div className="space-y-3">
                    {tasks.map((task) => (
                      <div
                        key={task._id}
                        className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-4 py-3"
                      >
                        <div>
                          <p className="font-medium">{task.name}</p>
                          <p className="text-xs text-slate-300">
                            Milestone: {milestoneMap[task.milestoneId] || "Milestone"}
                          </p>
                          <p className="text-xs text-slate-400">
                            Assigned: {task.assignedTo?.name || "Unassigned"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setPreviewTask(task)}
                            className="p-2 text-slate-200 hover:text-white bg-white/10 hover:bg-white/20 rounded"
                            title="Task Preview"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingTask(task)}
                            className="p-2 text-slate-200 hover:text-white bg-white/10 hover:bg-white/20 rounded"
                            title="Edit Task"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeletingTaskId(task._id)}
                            className="p-2 text-red-300 hover:text-red-200 bg-white/10 hover:bg-red-500/20 rounded"
                            title="Delete Task"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          {task.submission?.file?.url && (
                            <button
                              onClick={() => setPreviewTaskDoc(task)}
                              className="p-2 text-slate-200 hover:text-white bg-white/10 hover:bg-white/20 rounded"
                              title="Task Documents Preview"
                            >
                              <FileText className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="documents" className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Documents</h3>
                  <Button
                    className="bg-teal-600 hover:bg-teal-700 text-white"
                    onClick={() => setIsUploadDocsOpen(true)}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Documents
                  </Button>
                </div>
                {documents.length === 0 ? (
                  <div className="text-slate-300">No documents found.</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {documents.map((doc: any) => (
                      <div
                        key={doc._id}
                        className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-4 py-3"
                      >
                        <div>
                          <p className="font-medium">{doc.name}</p>
                          <p className="text-xs text-slate-300">
                            {doc.type} - {doc.status}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          className="bg-white/10 hover:bg-white/20 text-white"
                          onClick={() => setPreviewDoc(doc)}
                        >
                          Preview
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}

        {isAddMemberOpen && (
          <AddMemberModal
            members={teamMembersData}
            onClose={() => setIsAddMemberOpen(false)}
            onSubmit={(payload) => addMemberMutation.mutate(payload)}
          />
        )}

        {isAddMilestoneOpen && (
          <AddMilestoneModal
            onClose={() => setIsAddMilestoneOpen(false)}
            onSubmit={(name) => addMilestoneMutation.mutate(name)}
          />
        )}

        {isUploadDocsOpen && (
          <UploadDocumentsModal
            milestones={data?.milestones || []}
            projectId={data._id}
            onClose={() => setIsUploadDocsOpen(false)}
            onUploaded={() => {
              queryClient.invalidateQueries({ queryKey: ["project", projectId] });
              setIsUploadDocsOpen(false);
            }}
          />
        )}

        {previewDoc && (
          <DocumentPreviewModal document={previewDoc} onClose={() => setPreviewDoc(null)} />
        )}

        {previewTask && (
          <TaskPreviewModal
            task={previewTask}
            milestoneName={milestoneMap[previewTask.milestoneId]}
            onClose={() => setPreviewTask(null)}
          />
        )}

        {previewTaskDoc && (
          <DocumentPreviewModal
            document={{ file: previewTaskDoc.submission.file, name: previewTaskDoc.submission.docName }}
            onClose={() => setPreviewTaskDoc(null)}
          />
        )}

        {isAddTaskOpen && (
          <AddTaskModal
            isOpen={isAddTaskOpen}
            onClose={() => setIsAddTaskOpen(false)}
            projectId={data._id}
            milestones={data.milestones || []}
            teamMembers={data.teamMembers?.map((m) => m.user) || []}
            onCreated={() => queryClient.invalidateQueries({ queryKey: ["project", projectId] })}
          />
        )}

        {editingTask && (
          <EditTaskModal
            task={editingTask}
            isOpen={!!editingTask}
            onClose={() => setEditingTask(null)}
            milestones={data.milestones || []}
            teamMembers={data.teamMembers?.map((m) => m.user) || []}
            onUpdated={() => queryClient.invalidateQueries({ queryKey: ["project", projectId] })}
          />
        )}

        {deletingTaskId && (
          <DeleteConfirmDialog
            isOpen={!!deletingTaskId}
            title="Delete Task"
            description="Are you sure you want to delete this task? This action cannot be undone."
            onConfirm={() => deleteTaskMutation.mutate(deletingTaskId)}
            onCancel={() => setDeletingTaskId(null)}
            isLoading={deleteTaskMutation.isPending}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function AddMemberModal({
  members,
  onClose,
  onSubmit,
}: {
  members: any[];
  onClose: () => void;
  onSubmit: (payload: { userId: string; role?: string }) => void;
}) {
  const [memberId, setMemberId] = useState("");
  const [role, setRole] = useState("Contributor");

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-white/10 backdrop-blur-2xl border border-white/20 text-white max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Member</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm text-slate-200 mb-2 block">Select Team Member</label>
            <select
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
              className="w-full bg-black/40 border border-white/20 text-white rounded-xl px-3 py-2"
            >
              <option value="">Select member</option>
              {members.map((member) => (
                <option key={member._id} value={member._id}>
                  {member.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm text-slate-200 mb-2 block">Role</label>
            <Input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="bg-white/10 border-white/20 text-white"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button onClick={onClose} className="flex-1 bg-white/10 hover:bg-white/20 text-white">
              Cancel
            </Button>
            <Button
              onClick={() => memberId && onSubmit({ userId: memberId, role })}
              className="flex-1 bg-teal-600 hover:bg-teal-700 text-white"
            >
              Add Member
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddMilestoneModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (name: string) => void }) {
  const [name, setName] = useState("");

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-white/10 backdrop-blur-2xl border border-white/20 text-white max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Milestone</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            placeholder="Milestone name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-white/10 border-white/20 text-white"
          />
          <div className="flex gap-3 pt-2">
            <Button onClick={onClose} className="flex-1 bg-white/10 hover:bg-white/20 text-white">
              Cancel
            </Button>
            <Button
              onClick={() => name && onSubmit(name)}
              className="flex-1 bg-teal-600 hover:bg-teal-700 text-white"
            >
              Add Milestone
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function UploadDocumentsModal({
  milestones,
  projectId,
  onClose,
  onUploaded,
}: {
  milestones: { _id: string; name: string }[];
  projectId: string;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const [milestoneId, setMilestoneId] = useState(milestones[0]?._id || "");
  const [files, setFiles] = useState<File[]>([]);
  const uploadMutation = useMutation({
    mutationFn: async () => {
      const payload = new FormData();
      payload.append("projectId", projectId);
      if (milestoneId) payload.append("milestoneId", milestoneId);
      files.forEach((file) => payload.append("files", file));
      return documentsAPI.upload(payload);
    },
    onSuccess: () => {
      toast.success("Documents uploaded");
      onUploaded();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to upload documents");
    },
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-white/10 backdrop-blur-2xl border border-white/20 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload Documents</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm text-slate-200 mb-2 block">Milestone Name</label>
            <select
              value={milestoneId}
              onChange={(e) => setMilestoneId(e.target.value)}
              className="w-full bg-black/40 border border-white/20 text-white rounded-xl px-3 py-2"
            >
              {milestones.map((m) => (
                <option key={m._id} value={m._id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm text-slate-200 mb-2 block">Upload Documents</label>
            <Input
              type="file"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files || []))}
              className="bg-white/10 border-white/20 text-white"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button onClick={onClose} className="flex-1 bg-white/10 hover:bg-white/20 text-white">
              Cancel
            </Button>
            <Button
              onClick={() => uploadMutation.mutate()}
              disabled={files.length === 0 || uploadMutation.isPending}
              className="flex-1 bg-teal-600 hover:bg-teal-700 text-white"
            >
              {uploadMutation.isPending ? "Uploading..." : "Add Documents"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DocumentPreviewModal({ document, onClose }: { document: any; onClose: () => void }) {
  const url = document?.file?.url || document?.url;
  const isImage = url ? /\.(jpg|jpeg|png|gif|webp)$/i.test(url) : false;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-white/10 backdrop-blur-2xl border border-white/20 text-white max-w-3xl">
        <DialogHeader>
          <DialogTitle>Documents Preview</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {url ? (
            isImage ? (
              <img src={url} alt={document?.name || "Document"} className="w-full rounded-xl" />
            ) : (
              <iframe src={url} className="w-full h-[400px] rounded-xl" />
            )
          ) : (
            <p className="text-slate-300">No document available.</p>
          )}
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-teal-300"
            >
              Download Documents
            </a>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TaskPreviewModal({
  task,
  milestoneName,
  onClose,
}: {
  task: any;
  milestoneName?: string;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-white/10 backdrop-blur-2xl border border-white/20 text-white max-w-xl">
        <DialogHeader>
          <DialogTitle>Task Preview</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-slate-200">
          <div>
            <p className="text-sm text-slate-300">Task Name</p>
            <p className="font-semibold">{task.name}</p>
          </div>
          <div>
            <p className="text-sm text-slate-300">Milestone</p>
            <p className="font-semibold">{milestoneName || "N/A"}</p>
          </div>
          <div>
            <p className="text-sm text-slate-300">Assigned Team Member</p>
            <p className="font-semibold">{task.assignedTo?.name || "Unassigned"}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-slate-300">Start Date</p>
              <p className="font-semibold">
                {task.startDate ? new Date(task.startDate).toLocaleDateString() : "N/A"}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-300">End Date</p>
              <p className="font-semibold">
                {task.endDate ? new Date(task.endDate).toLocaleDateString() : "N/A"}
              </p>
            </div>
          </div>
          <div>
            <p className="text-sm text-slate-300">Status</p>
            <p className="font-semibold">{task.status}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
