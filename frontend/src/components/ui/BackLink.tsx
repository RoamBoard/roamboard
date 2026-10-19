"use client";

import { useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getBrowserBackHref, getServerBackHref, subscribeBackNavigation } from "@/lib/back-navigation";

export default function BackLink({ fallbackHref, className = "" }: { fallbackHref: string; className?: string }) {
    const router = useRouter();
    const backHref = useSyncExternalStore(subscribeBackNavigation, getBrowserBackHref, getServerBackHref);
    return (
        <a
            href={backHref ?? fallbackHref}
            data-back-navigation={backHref ? "back" : "replace"}
            className={`text-muted-foreground hover:text-foreground text-12 inline-flex min-h-11 min-w-11 items-center gap-2 py-2 lowercase focus-visible:rounded-[2px] focus-visible:outline-2 focus-visible:outline-offset-4 ${className}`}
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
            <ArrowLeft size={12} strokeWidth={1.3} aria-hidden="true" />
            Back
        </a>
    );
}
