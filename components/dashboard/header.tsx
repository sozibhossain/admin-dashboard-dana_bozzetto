"use client";

import { useSession } from "next-auth/react";
import { Bell, Search, Menu } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { notificationsAPI } from "@/lib/api";

export default function Header() {
  const { data: session } = useSession();
  const router = useRouter();

  const { data: notificationsData } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const res = await notificationsAPI.getAll();
      return res.data as { unreadCount: number };
    },
    staleTime: 30000,
  });

  const unreadCount = notificationsData?.unreadCount || 0;

  return (
    <header className="border-b border-slate-700 px-6 py-4 flex items-center justify-between">
      {/* Left */}
      <div className="flex items-center gap-4 flex-1">
        <button className="p-2 hover:bg-slate-700 rounded-lg transition">
          <Menu className="w-6 h-6 text-slate-300" />
        </button>
        <div className="relative hidden md:block flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search Projects, Clients, Documents, Finance...."
            className="w-full border border-white/10 bg-white/5 rounded-lg pl-10 pr-4 py-2 text-sm text-slate-300 placeholder:text-slate-500 focus:border-teal-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-6">
        {/* Notifications */}
        <button
          className="relative p-2 hover:bg-slate-700 rounded-lg transition"
          onClick={() => router.push("/dashboard/settings?tab=notifications")}
          aria-label="Open notifications"
        >
          <Bell className="w-6 h-6 text-slate-300" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] leading-[18px] text-center">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>

        {/* User Profile */}
        <div className="flex items-center gap-3 border-l border-slate-700 pl-6">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-white">
              {session?.user?.name || "Admin"}
            </p>
            <p className="text-xs text-slate-400 capitalize">
              {session?.user?.role || "admin"}
            </p>
          </div>
          <div className="w-10 h-10 bg-slate-700 rounded-lg flex items-center justify-center overflow-hidden">
            {session?.user?.avatar?.url ? (
              <Image
                src={session.user.avatar.url || "/placeholder.svg"}
                alt={session.user.name || "User"}
                width={40}
                height={40}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-white font-semibold">
                {(session?.user?.name || "A")[0].toUpperCase()}
              </span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
