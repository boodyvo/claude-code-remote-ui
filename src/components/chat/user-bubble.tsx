import { User } from "lucide-react";

interface UserBubbleProps {
  content: string;
}

export function UserBubble({ content }: UserBubbleProps) {
  return (
    <div className="flex justify-end gap-2 px-4 py-3">
      <div className="max-w-[85%] rounded-2xl rounded-br-md bg-user-bubble px-4 py-3 text-[14px] leading-relaxed text-user-bubble-foreground shadow-sm md:max-w-[70%]">
        <p className="whitespace-pre-wrap">{content}</p>
      </div>
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <User className="h-3.5 w-3.5" />
      </div>
    </div>
  );
}
