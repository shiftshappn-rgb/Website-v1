import {
  ArrowRight,
  Award,
  Clock,
  Droplets,
  Gift,
  Heart,
  Layers,
  Leaf,
  MapPin,
  Package,
  RefreshCw,
  Ruler,
  Shield,
  Shirt,
  ShoppingBag,
  Sparkles,
  Star,
  Truck,
  type LucideIcon,
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  arrowRight: ArrowRight,
  award: Award,
  bag: ShoppingBag,
  clock: Clock,
  droplets: Droplets,
  gift: Gift,
  heart: Heart,
  layers: Layers,
  leaf: Leaf,
  "map-pin": MapPin,
  mapPin: MapPin,
  package: Package,
  pants: Shirt,
  refresh: RefreshCw,
  refreshCw: RefreshCw,
  ruler: Ruler,
  shield: Shield,
  shirt: Shirt,
  sparkles: Sparkles,
  star: Star,
  truck: Truck,
};

export function BlockIcon({
  name,
  className,
}: {
  name?: string;
  className?: string;
}) {
  const Icon = name ? ICON_MAP[name] : null;
  if (!Icon) return <Sparkles className={className} strokeWidth={1.5} />;
  return <Icon className={className} strokeWidth={1.5} />;
}
