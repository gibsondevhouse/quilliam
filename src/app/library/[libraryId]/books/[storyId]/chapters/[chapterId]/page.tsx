"use client";

import { useParams } from "next/navigation";
import { ChapterEditorPage } from "@/components/ChapterEditorPage";

export default function StoryChapterPage() {
  const params = useParams<{ libraryId: string; storyId: string; chapterId: string }>();
  const { chapterId } = params;
  return <ChapterEditorPage chapterId={chapterId} />;
}
