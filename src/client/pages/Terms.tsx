import { useLanguage } from "../context/LanguageContext";

export default function Terms() {
  const { lang } = useLanguage();

  return (
    <div className="max-w-container-max mx-auto px-gutter py-8 md:py-12 flex flex-col gap-8 relative z-10 fade-in">
      <div>
        <h1 className="font-display-lg text-display-lg font-bold text-white mb-2">{lang === "uk" ? "Умови використання" : "Terms of Service"}</h1>
        <p className="text-label-sm text-on-surface-variant">{lang === "uk" ? "Останнє оновлення: 2026 рік" : "Last updated: 2026"}</p>
      </div>

      <div className="glass-panel rounded-2xl p-8 md:p-10 border border-white/10 flex flex-col gap-8 text-on-surface-variant text-body-md leading-relaxed">
        <section>
          <h2 className="text-headline-md font-headline-md text-emerald-glow mb-3 font-semibold">{lang === "uk" ? "1. Прийняття умов" : "1. Acceptance of Terms"}</h2>
          <p>
            {lang === "uk" ? (
              <>
                Використовуючи веб-сервіс <strong className="text-white">НЕЗБІГ 2.0</strong>, ви погоджуєтеся дотримуватися цих Умов використання. Якщо ви не погоджуєтеся з
                будь-яким із положень, просимо припинити використання сервісу.
              </>
            ) : (
              <>
                By accessing and using <strong className="text-white">NEZBIG 2.0</strong>, you accept and agree to be bound by these Terms of Service. If you do not agree, please
                discontinue using the service.
              </>
            )}
          </p>
        </section>

        <section>
          <h2 className="text-headline-md font-headline-md text-emerald-glow mb-3 font-semibold">{lang === "uk" ? "2. Опис сервісу" : "2. Description of Services"}</h2>
          <p className="mb-3">{lang === "uk" ? "НЕЗБІГ 2.0 надає користувачам інструменти для:" : "NEZBIG 2.0 provides tools for:"}</p>
          <ul className="list-disc list-inside space-y-2 pl-2">
            <li>
              {lang === "uk"
                ? "Автоматизованої перевірки тексту та документів на збіги у відкритих інтернет- та наукових джерелах."
                : "Automated text and document similarity scanning against open web and academic repositories."}
            </li>
            <li>{lang === "uk" ? "Аналізу тексту на ймовірні ознаки генерації штучним інтелектом (AI)." : "Stylometric evaluation of AI-generated content indicators."}</li>
            <li>{lang === "uk" ? "Стилістичного покращення («олюднення») тексту." : "Stylistic restructuring and AI text humanization."}</li>
          </ul>
        </section>

        <section>
          <h2 className="text-headline-md font-headline-md text-emerald-glow mb-3 font-semibold">
            {lang === "uk" ? "3. Інтелектуальна власність та права на текст" : "3. Intellectual Property Rights"}
          </h2>
          <p>
            {lang === "uk"
              ? "Ви зберігаєте всі авторські та виключні права на будь-який текст або документ, завантажений у сервіс. Сервіс НЕЗБІГ 2.0 не претендує на права власності щодо ваших матеріалів і не поширює їх."
              : "You retain full copyright and ownership of any text or document submitted to the service. NEZBIG 2.0 does not claim ownership or license rights over user content."}
          </p>
        </section>

        <section>
          <h2 className="text-headline-md font-headline-md text-emerald-glow mb-3 font-semibold">
            {lang === "uk" ? "4. Правила прийнятного використання" : "4. Acceptable Use Policy"}
          </h2>
          <p className="mb-3">{lang === "uk" ? "Користувачеві забороняється:" : "Users agree not to:"}</p>
          <ul className="list-disc list-inside space-y-2 pl-2">
            <li>
              {lang === "uk"
                ? "Здійснювати спроби порушити роботу сервісу, ліміти або стабільність серверної інфраструктури."
                : "Attempt to disrupt service infrastructure, bypass rate limits, or cause denial of service."}
            </li>
            <li>
              {lang === "uk"
                ? "Використовувати автоматизовані засоби (скрипти, боти) без попереднього погодження."
                : "Scrape or automate queries through scripts or bots without prior agreement."}
            </li>
            <li>{lang === "uk" ? "Завантажувати шкідливе програмне забезпечення або файли, що містять віруси." : "Upload malware or malicious payloads."}</li>
          </ul>
        </section>

        <section>
          <h2 className="text-headline-md font-headline-md text-emerald-glow mb-3 font-semibold">{lang === "uk" ? "5. Відмова від гарантій" : "5. Disclaimer of Warranties"}</h2>
          <p>
            {lang === "uk"
              ? "Результати перевірки на плагіат та виявлення AI носять виключно аналітичний та рекомендаційний характер. Сервіс надається за принципом «як є» («as is»). Ми не несемо відповідальності за академічні чи юридичні висновки, зроблені на основі згенерованих звітів."
              : 'Plagiarism and AI detection reports are analytical and advisory indicators provided on an "as is" basis. NEZBIG 2.0 does not provide legal or academic certification guarantees.'}
          </p>
        </section>
      </div>
    </div>
  );
}
