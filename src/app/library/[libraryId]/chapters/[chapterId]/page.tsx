"use client";

import { useParams } from "next/navigation";
import { ChapterEditorPage } from "@/components/ChapterEditorPage";

export default function ChapterPage() {
  const params = useParams<{ libraryId: string; chapterId: string }>();
  const { chapterId } = params;
  return <ChapterEditorPage chapterId={chapterId} />;
}
