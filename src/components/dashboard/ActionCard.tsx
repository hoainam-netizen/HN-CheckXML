import { Icon } from "@iconify/react/dist/iconify.js";
import { Progress } from "flowbite-react";

export const ActionCard = ({
    title,
    icon,
    onClick,
    disabled = false
}: {
    title: string;
    icon: string;
    onClick: () => void;
    disabled?: boolean;
}) => (
    <div
        onClick={!disabled ? onClick : undefined}
        className={`bg-white rounded-xl shadow-md p-6 transition-opacity duration-200 ${disabled ? "opacity-50 pointer-events-none" : "cursor-pointer"
            }`}
    >
        <div className="flex items-center gap-4 mb-4">
            <div className="bg-lightgray text-primary p-3 rounded-md">
                <Icon icon={icon} height={20} />
            </div>
            <p className="text-base font-semibold text-dark">{title}</p>
        </div>
        <Progress progress={100} color={disabled ? "gray" : "primary"} />
    </div>
);