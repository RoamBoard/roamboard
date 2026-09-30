import type { Metadata } from "next";
import BoardPreviewForm from "@/components/features/boards/BoardPreviewForm";

export const metadata: Metadata = {
  title: "Board input test | Roamboard",
  robots: { index: false, follow: false },
};

export default function BoardInputTestPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-8">
      <h1 className="font-display text-36">Board input test</h1>
      <p className="mt-3 mb-8">
        Fill in the form to preview the Board data collected by the frontend.
        Nothing is saved or sent to a backend. Refreshing clears the form.
      </p>
      <BoardPreviewForm />
    </main>
  );
}
