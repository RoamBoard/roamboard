import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { navigationLinkClassName } from "@/lib/navigation-link-style";

export default function ViewAllBoards({ href }: { href: string }) {
    return (
        <Link href={href} className={navigationLinkClassName}>
            view all <ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" />
        </Link>
    );
}
