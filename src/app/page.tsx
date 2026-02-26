"use client";

import { Chat } from "@/components/Chat";
import { useSystemContext } from "@/lib/context/SystemContext";

export default function Home() {
  const { status } = useSystemContext();

  return (
    <div className="home-chat-page">
      <Chat
        model={status.model}
        mode={status.mode}
        variant="landing"
      />
    </div>
  );
}
