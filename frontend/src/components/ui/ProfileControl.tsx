import type { ReactNode } from "react";
import Link from "next/link";

export type ProfileControlProps = {
    href: string;
    label?: ReactNode;
};

export default function ProfileControl({
    href,
    label = (
        <>
            My
            <br />
            Profile
        </>
    )
}: ProfileControlProps) {
    const controlClasses =
        "absolute left-[36%] top-[45%] text-left text-14 leading-none focus-visible:outline-1 focus-visible:outline-offset-4";

    return (
        <div className="absolute top-0 right-[1.3%] h-[8.75rem] w-[8.25rem] sm:h-[24%] sm:w-[14.5%]">
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0"
            >
                <span className="bg-stone absolute top-[18%] right-[9%] left-0 h-0.5" />
                <span className="bg-stone absolute top-0 right-[17%] h-[39%] w-0.5" />
                <span className="bg-stone absolute top-[25%] bottom-0 left-[32%] w-0.5" />
                <span className="bg-stone absolute top-[66%] right-0 left-[16%] h-0.5" />
            </div>
            <Link href={href} className={controlClasses}>
                {label}
            </Link>
        </div>
    );
}
