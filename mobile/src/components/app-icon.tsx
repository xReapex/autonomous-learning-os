import {
  ArrowLeft,
  ArrowRight,
  Apple,
  Award,
  BookOpenCheck,
  BookOpenText,
  BookMarked,
  Brain,
  ChartNoAxesColumnIncreasing,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleCheckBig,
  ClipboardCheck,
  Clock3,
  CloudAlert,
  CloudCheck,
  CloudOff,
  Flame,
  FlagTriangleRight,
  GalleryVerticalEnd,
  House,
  Info,
  KeyRound,
  Languages,
  LockKeyhole,
  LogIn,
  LogOut,
  MousePointerClick,
  MessagesSquare,
  NotebookPen,
  Play,
  Repeat2,
  RefreshCw,
  Route,
  Save,
  Search,
  Send,
  Trophy,
  Trash2,
  UserRound,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import type { ColorValue } from 'react-native';

const icons = {
  'arrow-left': ArrowLeft,
  'arrow-right': ArrowRight,
  apple: Apple,
  award: Award,
  'book-complete': BookOpenCheck,
  'book-build': BookMarked,
  'book-open': BookOpenText,
  'brief-check': ClipboardCheck,
  brain: Brain,
  cards: GalleryVerticalEnd,
  chart: ChartNoAxesColumnIncreasing,
  check: Check,
  'check-circle': CircleCheckBig,
  'chevron-down': ChevronDown,
  'chevron-right': ChevronRight,
  'chevron-up': ChevronUp,
  clock: Clock3,
  close: X,
  'cloud-alert': CloudAlert,
  'cloud-check': CloudCheck,
  'cloud-off': CloudOff,
  flame: Flame,
  flag: FlagTriangleRight,
  'hand-pointer': MousePointerClick,
  messages: MessagesSquare,
  home: House,
  info: Info,
  key: KeyRound,
  language: Languages,
  lock: LockKeyhole,
  login: LogIn,
  logout: LogOut,
  exercises: NotebookPen,
  refresh: RefreshCw,
  reviews: Repeat2,
  route: Route,
  save: Save,
  search: Search,
  send: Send,
  trophy: Trophy,
  delete: Trash2,
  user: UserRound,
  youtube: Play,
} satisfies Record<string, LucideIcon>;

export type AppIconName = keyof typeof icons;

export function AppIcon({
  name,
  color,
  size = 20,
  strokeWidth = 2,
}: {
  name: AppIconName;
  color: ColorValue;
  size?: number;
  strokeWidth?: number;
}) {
  const Icon = icons[name];
  return (
    <Icon
      absoluteStrokeWidth
      color={color}
      size={size}
      strokeWidth={strokeWidth}
    />
  );
}
