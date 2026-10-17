import { notFound } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import ImageLibraryLab from "@/components/features/image-library/ImageLibraryLab";

export default function ImagesPage() {
    if (process.env.NODE_ENV !== "development") notFound();
    return (
        <AppShell activeHref="/dev/images">
            <ImageLibraryLab />
        </AppShell>
    );
}
