import type { ComponentType, ReactElement } from "react";
import {
  Bot,
  Briefcase,
  ChartColumn,
  Check,
  ClipboardList,
  Clock,
  FileText,
  Gauge,
  Layers,
  MessageSquare,
  Mic,
  Shield,
  Sparkles,
  Star,
  Target,
  Upload,
  Users,
  Video,
  Zap,
} from "lucide-react";
import type { IconKey } from "@/lib/icons";
import { GitHubIcon, LinkedInIcon, XIcon } from "@/components/ui/BrandIcons";

type RegisteredIconProps = {
  className?: string;
  "aria-hidden"?: boolean | "true" | "false";
};

export type IconComponent = ComponentType<RegisteredIconProps>;

const iconRegistry: Record<IconKey, IconComponent> = {
  upload: Upload,
  briefcase: Briefcase,
  video: Video,
  clipboard: ClipboardList,
  bot: Bot,
  "file-text": FileText,
  mic: Mic,
  zap: Zap,
  chart: ChartColumn,
  layers: Layers,
  check: Check,
  target: Target,
  shield: Shield,
  sparkles: Sparkles,
  gauge: Gauge,
  clock: Clock,
  users: Users,
  star: Star,
  message: MessageSquare,
  twitter: XIcon,
  linkedin: LinkedInIcon,
  github: GitHubIcon,
};

interface IconProps {
  name: IconKey;
  className?: string;
}

/** Renders the registered icon for a content model's icon key. */
export function Icon({ name, className }: IconProps): ReactElement {
  const Component = iconRegistry[name];
  return <Component className={className} aria-hidden="true" />;
}
