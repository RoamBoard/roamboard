"use client";

import { useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { navigationLinkClassName } from "@/lib/navigation-link-style";
import { getBrowserBackHref, getServerBackHref, subscribeBackNavigation } from "@/lib/back-navigation";

export default function BackLink({ fallbackHref, className = "" }: { fallbackHref: string; className?: string }) {
    const router = useRouter();
    const backHref = useSyncExternalStore(subscribeBackNavigation, getBrowserBackHref, getServerBackHref);
    return (
        <a
            href={backHref ?? fallbackHref}
            data-back-navigation={backHref ? "back" : "replace"}
            className={`${navigationLinkClassName} ${className}`}
            onClick={(event) => {
                if (
                    event.defaultPrevented ||
                    event.button !== 0 ||
                    event.metaKey ||
                    event.ctrlKey ||
                    event.shiftKey ||
                    event.altKey
                )
                    return;
                event.preventDefault();
                if (backHref) router.back();
                else router.replace(fallbackHref);
            }}
        >
            <ArrowLeft size={16} strokeWidth={1.5} aria-hidden="true" />
            Back
        </a>
    );
}
