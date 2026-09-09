import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { ChartBar, ChartPie, Database, Layers, SquareKanban } from "lucide-react";

import { BorderBeam } from "~/components/ui/border-beam";
import { Button } from "~/components/ui/shadcn-button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { cn } from "~/lib/utils";

export type Hero195Tab = {
  title: string;
  icon: ReactNode;
  image: string;
  imageAlt?: string;
};

export type Hero195Props = {
  title?: string;
  description?: string;
  primaryButtonText?: string;
  primaryButtonUrl?: string;
  secondaryButtonText?: string;
  secondaryButtonUrl?: string;
  secondaryOpensNewTab?: boolean;
  tabs?: Hero195Tab[];
  className?: string;
};

const defaultTabs: Hero195Tab[] = [
  {
    title: "Insights",
    icon: <SquareKanban className="size-4" />,
    image:
      "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1600&q=80",
    imageAlt: "Analytics dashboard",
  },
  {
    title: "Metrics",
    icon: <ChartBar className="size-4" />,
    image:
      "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1600&q=80",
    imageAlt: "Business metrics charts",
  },
  {
    title: "Trends",
    icon: <ChartPie className="size-4" />,
    image:
      "https://images.unsplash.com/photo-1553729459-efe14ef6055d?auto=format&fit=crop&w=1600&q=80",
    imageAlt: "Trend reporting",
  },
  {
    title: "Sources",
    icon: <Database className="size-4" />,
    image:
      "https://images.unsplash.com/photo-1542744173-8eaa8c01d095?auto=format&fit=crop&w=1600&q=80",
    imageAlt: "Team working with data",
  },
  {
    title: "Models",
    icon: <Layers className="size-4" />,
    image:
      "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1600&q=80",
    imageAlt: "Product modeling workspace",
  },
];

function HeroLink({
  href,
  children,
  newTab = false,
}: {
  href: string;
  children: ReactNode;
  newTab?: boolean;
}) {
  if (newTab || href.startsWith("http://") || href.startsWith("https://")) {
    return (
      <a href={href} target="_blank" rel="noreferrer">
        {children}
      </a>
    );
  }

  return <Link to={href}>{children}</Link>;
}

export function Hero195({
  title = "Beautiful blocks for Shadcn UI.",
  description = "Shadcnblocks.com offers the best collection of components and blocks for shadcn/ui.",
  primaryButtonText = "Download",
  primaryButtonUrl = "https://shadcnblocks.com",
  secondaryButtonText,
  secondaryButtonUrl,
  secondaryOpensNewTab = false,
  tabs = defaultTabs,
  className,
}: Hero195Props) {
  const [activeTab, setActiveTab] = useState(tabs[0]?.title ?? "");

  return (
    <section className={cn("overflow-hidden", className)}>
      <div className="border-x border-border py-12 md:py-16">
        <div className="relative mx-auto max-w-2xl p-2">
          <h1 className="mx-1 mt-2 text-center font-serif text-4xl font-bold tracking-tight text-foreground md:text-6xl">
            {title}
          </h1>
          <p className="mx-2 mt-6 max-w-xl text-center text-lg font-medium text-muted-foreground md:mx-auto md:text-xl">
            {description}
          </p>
          <div className="mx-2 mt-6 flex flex-wrap justify-center gap-2">
            <Button asChild>
              <HeroLink href={primaryButtonUrl}>{primaryButtonText}</HeroLink>
            </Button>
            {secondaryButtonText && secondaryButtonUrl ? (
              <Button variant="outline" asChild>
                <HeroLink href={secondaryButtonUrl} newTab={secondaryOpensNewTab}>
                  {secondaryButtonText}
                </HeroLink>
              </Button>
            ) : null}
          </div>
        </div>

        <div className="mt-12 md:mt-16">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="px-2">
              <TabsList className="mx-auto mb-6 flex h-auto w-fit max-w-xs flex-wrap justify-center gap-2 bg-transparent p-0 md:max-w-none">
                {tabs.map((tab) => (
                  <TabsTrigger
                    key={tab.title}
                    value={tab.title}
                    className="gap-1.5 font-normal text-muted-foreground"
                  >
                    {tab.icon}
                    {tab.title}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <div className="relative px-2 md:px-6">
              <span className="absolute inset-x-[-20%] top-0 -z-10 h-px bg-border [mask-image:linear-gradient(to_right,transparent_1%,black_10%,black_90%,transparent_99%)]" />
              <span className="absolute inset-x-[-20%] bottom-0 -z-10 h-px bg-border [mask-image:linear-gradient(to_right,transparent_1%,black_10%,black_90%,transparent_99%)]" />
              <span className="absolute inset-x-[-20%] top-12 h-px border-t border-dashed border-border [mask-image:linear-gradient(to_right,transparent_1%,black_10%,black_90%,transparent_99%)]" />
              <span className="absolute inset-x-[-20%] bottom-12 h-px border-t border-dashed border-border [mask-image:linear-gradient(to_right,transparent_1%,black_10%,black_90%,transparent_99%)]" />
              <span className="absolute inset-y-[-20%] left-[16%] w-px border-r border-dashed border-border [mask-image:linear-gradient(to_bottom,transparent_1%,black_10%,black_90%,transparent_99%)]" />
              <span className="absolute inset-y-[-20%] right-[16%] w-px border-r border-dashed border-border [mask-image:linear-gradient(to_bottom,transparent_1%,black_10%,black_90%,transparent_99%)]" />

              {tabs.map((tab) => (
                <TabsContent key={tab.title} value={tab.title} className="mt-0">
                  <div className="relative overflow-hidden rounded-lg border bg-card shadow-sm">
                    <img
                      src={tab.image}
                      alt={tab.imageAlt ?? tab.title}
                      className="aspect-video w-full object-cover"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-charcoal/25 via-transparent to-white/10" />
                    <BorderBeam
                      size={200}
                      duration={12}
                      delay={0}
                      colorFrom="#5ca8d6"
                      colorTo="#d4713a"
                    />
                  </div>
                </TabsContent>
              ))}
            </div>
          </Tabs>
        </div>
      </div>
    </section>
  );
}
