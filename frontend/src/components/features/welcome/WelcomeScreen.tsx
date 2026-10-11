import Image from "next/image";
import EnterTransition from "@/components/features/welcome/EnterTransition";
import WelcomeUsername from "@/components/features/welcome/WelcomeUsername";
import ThemeSelect from "@/components/ui/ThemeSelect";

type Props = {
    username: string;
};

export default function WelcomeScreen({ username }: Props) {
    return (
        <main className="font-body bg-background text-foreground relative h-dvh min-h-128 w-full overflow-hidden">
            <h1 className="sr-only">Welcome back, {username}</h1>

            <div
                className="pointer-events-none absolute inset-0"
                aria-hidden="true"
            >
                <span className="bg-faint absolute inset-y-0 left-[2.25%] w-px" />
                <span className="bg-faint absolute inset-y-0 right-[2.25%] w-px" />
                <span className="bg-faint absolute inset-x-0 top-[3.5%] h-px" />
                <span className="bg-faint absolute inset-x-0 bottom-[3.5%] h-px" />
            </div>

            <p className="text-muted-foreground absolute top-[3.5%] right-[2.25%] text-right text-[length:clamp(0.625rem,0.8vw,1rem)] leading-[1.05]">
                THE WORLD
                <br />
                AWAITS
            </p>

            <div
                className="[container-type:size] absolute inset-0 [@media(max-aspect-ratio:1/1)]:top-1/2 [@media(max-aspect-ratio:1/1)]:bottom-auto [@media(max-aspect-ratio:1/1)]:aspect-[3456/2234] [@media(max-aspect-ratio:1/1)]:h-auto [@media(max-aspect-ratio:1/1)]:-translate-y-[55%]"
                aria-hidden="true"
            >
                <div className="absolute top-[6.25%] left-[6.5%] h-[70.4%] w-[26%] overflow-hidden">
                    <Image
                        src="/images/welcome/blossoms.jpg"
                        alt=""
                        fill
                        sizes="26vw"
                        preload
                        className="object-cover"
                    />
                </div>
                <div className="absolute top-[8.7%] left-[41.9%] h-[65.8%] w-[36.5%] overflow-hidden">
                    <Image
                        src="/images/welcome/water.jpg"
                        alt=""
                        fill
                        sizes="75vw"
                        preload
                        className="origin-top scale-[2.05] object-cover object-top"
                    />
                </div>
                <div className="absolute top-[13%] left-[26.9%] z-1 h-[68.8%] w-[26.9%] overflow-hidden">
                    <Image
                        src="/images/welcome/flowers.jpg"
                        alt=""
                        fill
                        sizes="27vw"
                        preload
                        className="object-cover"
                    />
                </div>

                <span className="absolute top-[8.6%] left-[15%] z-2 origin-top-left rotate-90 text-[length:min(8cqw,12.37cqh)] leading-none font-normal text-white">
                    WELCOME
                </span>
                <span className="absolute bottom-[20%] left-[28.3%] z-2 text-[length:min(8.15cqw,12.61cqh)] leading-none font-normal text-white">
                    BACK
                </span>
                <WelcomeUsername username={username} />
            </div>

            <p
                className="font-display absolute bottom-[3.5%] left-[2.25%] translate-y-[0.1em] text-[8.4vw] leading-none font-medium tracking-[-0.04em]"
                aria-hidden="true"
            >
                ROAMBOARD
            </p>
            <p className="text-muted-foreground absolute right-[2.25%] bottom-[3.5%] text-right text-[length:clamp(0.625rem,0.8vw,1rem)] leading-[1.05]">
                READY TO
                <br />
                DISCOVER IT?
            </p>

            <EnterTransition />
            <div className="absolute right-[2.25%] bottom-[calc(3.5%+2.5rem)] z-10">
                <ThemeSelect side="top" />
            </div>
        </main>
    );
}
