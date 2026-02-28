"use client";

import { useParams } from "next/navigation";
import { BookTimelinePage } from "@/components/BookTimelinePage";

export default function BookTimelineRoute() {
  const { storyId } = useParams<{ storyId: string }>();
  return <BookTimelinePage storyId={storyId} />;
}
