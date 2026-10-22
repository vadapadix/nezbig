import { useLanguage } from "../context/LanguageContext";

export default function About() {
  const { lang } = useLanguage();

  return (
    <div className="max-w-container-max mx-auto px-gutter py-8 md:py-12 flex flex-col gap-8 relative z-10 fade-in">
      <h1 className="font-display-lg text-display-lg font-bold text-white">{lang === "uk" ? "Про нас" : "About Nezbig"}</h1>
      <div className="glass-panel rounded-2xl p-8 border border-white/10">
        <h2 className="text-headline-lg font-headline-lg text-emerald-glow mb-4 font-bold">{lang === "uk" ? "Наша місія" : "Our Mission"}</h2>
        <p className="text-body-lg text-on-surface-variant mb-6 leading-relaxed">
          {lang === "uk"
            ? "НЕЗБІГ 2.0 створений для того, щоб надати кожному доступний інструмент для чесної та ефективної перевірки тексту на плагіат та ознаки штучного інтелекту. Ми віримо, що кожен автор заслуговує на можливість створювати унікальний контент, а викладачі та редактори — на надійний спосіб перевірки оригінальності."
            : "NEZBIG 2.0 helps writers review open-web text matches, heuristic AI signals and automatic style suggestions. Results support human review and do not establish authorship or academic integrity."}
        </p>

        <h2 className="text-headline-lg font-headline-lg text-emerald-glow mb-4 mt-8 font-bold">{lang === "uk" ? "Чому обирають Незбіг?" : "Key Advantages"}</h2>
        <ul className="list-disc list-inside text-body-lg text-on-surface-variant space-y-3 leading-relaxed">
          <li>
            <strong className="text-white">{lang === "uk" ? "Мультипошукова перевірка на плагіат:" : "Deep Plagiarism Search:"}</strong>{" "}
            {lang === "uk"
              ? "сканування відкритих вебджерел та міжнародних наукових баз (Crossref DOI, OpenAlex, Вікіпедія)."
              : "scanning across open web indices and global academic registries (Crossref DOI, OpenAlex, Wikipedia)."}
          </li>
          <li>
            <strong className="text-white">{lang === "uk" ? "Евристичний AI-аналіз:" : "Heuristic AI Analysis:"}</strong>{" "}
            {lang === "uk"
              ? "аналіз стилометричних ознак із зазначенням надійності. Він не визначає конкретну модель чи авторство; якість на реальних роботах потребує окремої валідації."
              : "stylometric signals with reliability information. It does not identify a specific model or establish authorship; performance on real documents requires separate validation."}
          </li>
          <li>
            <strong className="text-white">{lang === "uk" ? "Приватна історія:" : "Private History:"}</strong>{" "}
            {lang === "uk"
              ? "звіти облікового запису доступні лише власнику та видаляються з історії разом із серверними копіями. Вебпошук і AI-думка використовують зовнішніх провайдерів; подробиці наведені в політиці конфіденційності."
              : "account reports are owner-only and deleting history also deletes server report copies. Web search and AI opinion use external providers; see the privacy policy for details."}
          </li>
          <li>
            <strong className="text-white">{lang === "uk" ? "Олюднювач тексту:" : "AI Text Humanizer:"}</strong>{" "}
            {lang === "uk"
              ? "автоматичні стильові заміни за правилами у трьох режимах. Зміст і точність результату потрібно перевірити вручну."
              : "rule-based style replacements in three modes. Review the resulting meaning and accuracy manually."}
          </li>
        </ul>
      </div>
    </div>
  );
}
