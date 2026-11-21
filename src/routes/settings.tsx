import { createFileRoute } from "@tanstack/react-router";
import { BottomNav } from "@/components/BottomNav";
import { useSettings, type RefreshInterval } from "@/hooks/use-settings";

const OPTIONS: { value: RefreshInterval; label: string }[] = [
  { value: 5, label: "Каждые 5 минут" },
  { value: 15, label: "Каждые 15 минут" },
  { value: 30, label: "Каждые 30 минут" },
  { value: 60, label: "Каждый час" },
  { value: 0, label: "Только вручную" },
];

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Настройки — Кроссы.by" },
      { name: "description", content: "Настройка интервала автообновления каталога." },
      { property: "og:title", content: "Настройки — Кроссы.by" },
      { property: "og:description", content: "Автообновление каталога и установка приложения на iPhone." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { settings, update, hydrated } = useSettings();

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-background pb-20">
      <header className="sticky top-0 z-30 bg-primary px-4 py-3">
        <h1 className="text-xl font-black italic uppercase tracking-tight text-primary-foreground">
          Настройки
        </h1>
      </header>

      <main className="space-y-6 p-4">
        <section>
          <h2 className="text-xs font-black uppercase tracking-wide text-muted-foreground">
            Автообновление каталога
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Каталог и цены обновляются с adishop.by в фоне, пока приложение открыто. По каждому
            обновлению проверяются изменения в избранном и появляются уведомления.
          </p>
          {hydrated ? (
            <div className="mt-3 divide-y divide-border border border-border">
              {OPTIONS.map((o) => (
                <label
                  key={o.value}
                  className="flex cursor-pointer items-center justify-between px-3 py-3 text-sm"
                >
                  <span className="font-semibold">{o.label}</span>
                  <input
                    type="radio"
                    name="refresh"
                    checked={settings.refreshMinutes === o.value}
                    onChange={() => update({ refreshMinutes: o.value })}
                    className="h-4 w-4 accent-foreground"
                  />
                </label>
              ))}
            </div>
          ) : null}
        </section>

        <section>
          <h2 className="text-xs font-black uppercase tracking-wide text-muted-foreground">
            Установка на iPhone
          </h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-foreground/90">
            <li>Откройте сайт в Safari.</li>
            <li>Нажмите кнопку «Поделиться» ⬆︎.</li>
            <li>Выберите «На экран „Домой“».</li>
            <li>
              Готово: приложение запустится в полноэкранном режиме с иконкой{" "}
              <span className="font-black">Кроссы.by</span>.
            </li>
          </ol>
        </section>

        <section>
          <h2 className="text-xs font-black uppercase tracking-wide text-muted-foreground">
            Аккаунт
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Вход и регистрация с синхронизацией избранного между устройствами —{" "}
            <span className="font-semibold text-foreground">в следующем обновлении</span>.
          </p>
        </section>

        <p className="pt-4 text-center text-[11px] text-muted-foreground">
          Данные с adishop.by · история цен и уведомления хранятся в этом браузере
        </p>
      </main>

      <BottomNav />
    </div>
  );
}
