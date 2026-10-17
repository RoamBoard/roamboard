type Props = { name: "collaborators" | "friends" | "public" | "information" };

const dimensions = { collaborators: [17, 19], friends: [19, 16], public: [19, 19], information: [10.5, 10.5] };

export default function CreatorDetailIcon({ name }: Props) {
    const [width, height] = dimensions[name];
    return (
        <span
            aria-hidden="true"
            className="inline-block shrink-0 bg-current"
            style={{ width, height, mask: `url('/images/create/details/${name}.svg') center / contain no-repeat` }}
        />
    );
}
