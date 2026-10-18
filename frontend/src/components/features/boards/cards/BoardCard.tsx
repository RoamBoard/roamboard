import type {
    BoardCardActions,
    CollageBoardCardData,
    CompactBoardCardData,
    LandscapeBoardCardData,
    PhotoBoardCardProps
} from "@/types/board-card";
import CollageBoardCard from "./CollageBoardCard";
import CompactBoardCard from "./CompactBoardCard";
import LandscapeBoardCard from "./LandscapeBoardCard";
import PhotoBoardCard from "./PhotoBoardCard";

export type BoardCardProps = BoardCardActions &
    (
        | { variant: "collage"; board: CollageBoardCardData }
        | { variant: "compact"; board: CompactBoardCardData }
        | { variant: "landscape"; board: LandscapeBoardCardData }
        | ({ variant: "photo" } & PhotoBoardCardProps)
    );

export default function BoardCard(props: BoardCardProps) {
    switch (props.variant) {
        case "collage":
            return <CollageBoardCard {...props} />;
        case "compact":
            return <CompactBoardCard {...props} />;
        case "landscape":
            return <LandscapeBoardCard {...props} />;
        case "photo":
            return <PhotoBoardCard {...props} />;
    }
}
