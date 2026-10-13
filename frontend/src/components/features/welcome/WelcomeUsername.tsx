type Props = {
    username: string;
};

export default function WelcomeUsername({ username }: Props) {
    return (
        <span className="absolute top-[13.8%] left-[44.75%] z-2 max-h-[2em] w-[33%] overflow-hidden text-[length:min(8.7cqw,13.46cqh)] leading-none font-normal [overflow-wrap:anywhere] text-white uppercase">
            {username}
        </span>
    );
}
