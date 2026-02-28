import { redirect } from "next/navigation";

interface LibraryRootPageProps {
  params: Promise<{
    libraryId: string;
  }>;
}

export default async function LibraryRootPage({ params }: LibraryRootPageProps) {
  const { libraryId } = await params;
  redirect(`/library/${libraryId}/universe`);
}
