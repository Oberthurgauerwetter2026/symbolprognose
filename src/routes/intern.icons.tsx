import { createFileRoute } from "@tanstack/react-router";
import {
  WeatherIcon,
  IconClear,
  IconClearNight,
  IconMostlyClear,
  IconPartlyCloudy,
  IconCloudy,
  IconFog,
  IconDrizzle,
  IconRain,
  IconSnow,
  IconThunderstorm,
  IconSunShower,
  IconSunThunder,
  IconSunSnowThunder,
  IconSnowThunder,
} from "@/components/weather-icons";
import { MchPictogram } from "@/components/weather-icons/mch-pictogram";
import { mchLabel } from "@/components/weather-icons/mch-spec";
import type { ReactNode } from "react";

export const Route = createFileRoute("/intern/icons")({
  ssr: false,
  component: IconsPage,
  head: () => ({
    meta: [
      { title: "Intern · Icon-Katalog" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function Tile({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-4">
      <div className="flex w-full items-end justify-around gap-3">
        <div className="rounded-md bg-white p-3 shadow-sm">{children}</div>
        <div className="rounded-md bg-slate-900 p-3 shadow-sm">{children}</div>
      </div>
      <div className="text-center">
        <div className="font-mono text-xs font-semibold text-foreground">{label}</div>
        {hint ? <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div> : null}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {children}
      </div>
    </section>
  );
}

const SIZE = 72;

function IconsPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-8 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Wetter-Icon-Katalog</h1>
        <p className="text-sm text-muted-foreground">
          Alle Symbole, die <code className="font-mono">WeatherIcon</code> ausspielen kann — jeweils
          auf hellem und dunklem Hintergrund.
        </p>
      </header>

      <Section title="Klar / wenig Wolken">
        <Tile label="IconClear" hint="WMO 0 · Tag">
          <IconClear size={SIZE} />
        </Tile>
        <Tile label="IconClearNight" hint="WMO 0 · Nacht">
          <IconClearNight size={SIZE} />
        </Tile>
        <Tile label="IconMostlyClear" hint="WMO 1 · Tag">
          <IconMostlyClear size={SIZE} isDay />
        </Tile>
        <Tile label="IconMostlyClear" hint="WMO 1 · Nacht">
          <IconMostlyClear size={SIZE} isDay={false} />
        </Tile>
        <Tile label="IconPartlyCloudy" hint="WMO 2 · Tag">
          <IconPartlyCloudy size={SIZE} isDay />
        </Tile>
        <Tile label="IconPartlyCloudy" hint="WMO 2 · Nacht">
          <IconPartlyCloudy size={SIZE} isDay={false} />
        </Tile>
      </Section>

      <Section title="Bewölkt / Nebel">
        <Tile label="IconCloudy" hint="WMO 3">
          <IconCloudy size={SIZE} />
        </Tile>
        <Tile label="IconFog" hint="WMO 45, 48">
          <IconFog size={SIZE} />
        </Tile>
      </Section>

      <Section title="Niederschlag">
        <Tile label="IconDrizzle" hint="WMO 51–57, 80/81 stündl.">
          <IconDrizzle size={SIZE} />
        </Tile>
        <Tile label="IconRain" hint="WMO 61–67, 82 stündl.">
          <IconRain size={SIZE} />
        </Tile>
        <Tile label="IconSunShower" hint="Sonnenschauer">
          <IconSunShower size={SIZE} />
        </Tile>
        <Tile label="IconThunderstorm" hint="WMO 95–99">
          <IconThunderstorm size={SIZE} />
        </Tile>
        <Tile label="IconSunThunder" hint="lokales Gewitter · int. 2">
          <IconSunThunder size={SIZE} intensity={2} />
        </Tile>
        <Tile label="IconSunThunder" hint="int. 3">
          <IconSunThunder size={SIZE} intensity={3} />
        </Tile>
        <Tile label="IconSunThunder" hint="int. 4">
          <IconSunThunder size={SIZE} intensity={4} />
        </Tile>
      </Section>

      <Section title="Winter / Schnee">
        <Tile label="IconSnow" hint="WMO 71–77, 85, 86">
          <IconSnow size={SIZE} />
        </Tile>
        <Tile label="IconSnowThunder" hint="Wintergewitter">
          <IconSnowThunder size={SIZE} />
        </Tile>
        <Tile label="IconSunSnowThunder" hint="Schnee-Schauer-Gewitter · int. 2">
          <IconSunSnowThunder size={SIZE} intensity={2} />
        </Tile>
        <Tile label="IconSunSnowThunder" hint="int. 3">
          <IconSunSnowThunder size={SIZE} intensity={3} />
        </Tile>
        <Tile label="IconSunSnowThunder" hint="int. 4">
          <IconSunSnowThunder size={SIZE} intensity={4} />
        </Tile>
      </Section>

      <Section title="Dispatcher-Beispiele (WeatherIcon)">
        <Tile label="code=2, low=80%" hint="→ Cloudy via Stockwerke">
          <WeatherIcon code={2} size={SIZE} cloudLow={80} cloudMid={20} cloudHigh={10} />
        </Tile>
        <Tile label="code=2, high=60%" hint="→ MostlyClear (Cirrus)">
          <WeatherIcon code={2} size={SIZE} cloudLow={10} cloudMid={15} cloudHigh={60} />
        </Tile>
        <Tile label="code=3, sun=0.7" hint="→ MostlyClear (Sonnen-Korrektiv)">
          <WeatherIcon code={3} size={SIZE} sunshineRatio={0.7} scope="daily" />
        </Tile>
        <Tile label="code=61, sun=0.4" hint="→ SunShower stündlich">
          <WeatherIcon code={61} size={SIZE} sunshineRatio={0.4} precip={0.3} scope="hourly" />
        </Tile>
        <Tile label="daily wet + sun" hint="→ SunShower täglich">
          <WeatherIcon
            code={80}
            size={SIZE}
            scope="daily"
            precipHours={3}
            precip={4}
            sunshineRatio={0.4}
          />
        </Tile>
      </Section>
    </div>
  );
}
