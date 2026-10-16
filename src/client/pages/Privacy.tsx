import { useLanguage } from "../context/LanguageContext";

export default function Privacy() {
  const { lang } = useLanguage();

  return (
    <div className="max-w-container-max mx-auto px-gutter py-8 md:py-12 flex flex-col gap-8 relative z-10 fade-in">
      <div>
        <h1 className="font-display-lg text-display-lg font-bold text-white mb-2">
          {lang === "uk" ? "Політика конфіденційності" : "Privacy Policy"}
        </h1>
        <p className="text-label-sm text-on-surface-variant">
          {lang === "uk" ? "Останнє оновлення: 2026 рік" : "Last updated: 2026"}
        </p>
      </div>

      <div className="glass-panel rounded-2xl p-8 md:p-10 border border-white/10 flex flex-col gap-8 text-on-surface-variant text-body-md leading-relaxed">
        <section>
          <h2 className="text-headline-md font-headline-md text-emerald-glow mb-3 font-semibold">
            {lang === "uk" ? "1. Загальні положення" : "1. General Provisions"}
          </h2>
          <p>
            {lang === "uk" ? (
              <>
                Сервіс <strong className="text-white">НЕЗБІГ 2.0</strong> поважає вашу приватність та прагне забезпечити максимальний рівень захисту ваших персональних даних та перевірених документів. Ця Політика пояснює, як ми збираємо, використовуємо та захищаємо інформацію.
              </>
            ) : (
              <>
                <strong className="text-white">NEZBIG 2.0</strong> explains below how documents, account history and third-party processing are handled.
              </>
            )}
          </p>
        </section>

        <section>
          <h2 className="text-headline-md font-headline-md text-emerald-glow mb-3 font-semibold">
            {lang === "uk" ? "2. Обробка і збереження документів" : "2. Document Processing and Storage"}
          </h2>
          <p className="mb-3">
            {lang === "uk" ? "Обсяг збереження залежить від входу в обліковий запис:" : "Retention depends on whether you are signed in:"}
          </p>
          <ul className="list-disc list-inside space-y-2 pl-2">
            <li>
              <strong className="text-white">{lang === "uk" ? "Гостьові перевірки:" : "Guest scans:"}</strong>{" "}
              {lang === "uk" ? "Вихідні файли обробляються в пам’яті. Гостьові звіти та кеш результатів залишаються в пам’яті сервера до 30 хвилин, можуть бути витіснені раніше та не записуються до сховища історії. Після перезапуску сервера вони недоступні." : "Original files are processed in memory. Guest reports and result caches stay in server memory for up to 30 minutes, may be evicted sooner, and are not written to history storage. They are unavailable after a server restart."}
            </li>
            <li>
              <strong className="text-white">{lang === "uk" ? "Без використання для навчання AI:" : "No AI Model Training:"}</strong>{" "}
              {lang === "uk" ? "Ми ніколи не використовуємо ваші матеріали для донавчання моделей штучного інтелекту." : "We never train machine learning or AI models on user submissions."}
            </li>
            <li>
              <strong className="text-white">{lang === "uk" ? "Історія перевірок:" : "Scan history:"}</strong>{" "}
              {lang === "uk" ? "Браузер зберігає локальні копії звітів. Після входу перевірки та синхронізовані звіти також зберігаються у приватній історії облікового запису: назва файла, метрики, фрагменти збігів і до 100 000 символів вихідного тексту. Сервер може використовувати файлове сховище, Redis або KV. Файлові копії зберігаються до видалення, віддалені копії звітів мають строк до 30 днів. Видалення з історії видаляє також повний серверний звіт і очищає кеш результатів облікового запису." : "Your browser stores local report copies. After sign-in, scans and synchronized reports are also stored in private account history: filename, metrics, matching excerpts and up to 100,000 characters of source text. The server may use files, Redis or KV. File copies remain until deletion; remote report copies expire within 30 days. Deleting history also deletes full server reports and clears the account’s result cache."}
            </li>
            <li>
              <strong className="text-white">{lang === "uk" ? "Зовнішні сервіси:" : "External services:"}</strong>{" "}
              {lang === "uk" ? "Вебпошук надсилає уривки тексту пошуковим провайдерам. За налаштованого семантичного ранжування уривки й тексти джерел передаються Cohere. AI-думка передає вибрані частини документа налаштованим провайдерам OpenRouter або NVIDIA NIM. Кеш пошукових запитів також може містити уривки документа. Умови обробки зовнішніх сервісів визначають ці провайдери." : "Web search sends text excerpts to search providers. When semantic reranking is configured, excerpts and source texts are sent to Cohere. AI opinion sends selected document portions to configured OpenRouter or NVIDIA NIM providers. Search-query caches may also contain document excerpts. External providers determine their own data handling terms."}
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-headline-md font-headline-md text-emerald-glow mb-3 font-semibold">
            {lang === "uk" ? "3. Облікові записи та авторизація" : "3. Accounts and Authentication"}
          </h2>
          <p className="mb-3">
            {lang === "uk" ? "Якщо ви створюєте обліковий запис або входите через Google OAuth:" : "If you create an account or sign in with Google OAuth:"}
          </p>
          <ul className="list-disc list-inside space-y-2 pl-2">
            <li>{lang === "uk" ? "Ми зберігаємо ім’я, email, аватар, ідентифікатор Google за його використання та приватну історію перевірок." : "We store your name, email, avatar, Google identifier when used, and private scan history."}</li>
            <li>{lang === "uk" ? "Паролі шифруються за допомогою надійних односторонніх криптографічних алгоритмів (bcrypt)." : "Passwords are encrypted using industry-standard bcrypt hashing."}</li>
            <li>{lang === "uk" ? "Сесії автентифікації захищені сучасними захищеними куками (HTTP-only)." : "Authentication sessions use secure, HTTP-only cookies."}</li>
          </ul>
        </section>

        <section>
          <h2 className="text-headline-md font-headline-md text-emerald-glow mb-3 font-semibold">
            {lang === "uk" ? "4. Безпека передачі даних" : "4. Transport Security"}
          </h2>
          <p>
            {lang === "uk"
              ? "Публічне розгортання має використовувати HTTPS/TLS. У виробничому режимі сесійні cookie мають прапорці Secure та HTTP-only. Локальна розробка може використовувати HTTP."
              : "Public deployments must use HTTPS/TLS. Production session cookies use Secure and HTTP-only flags. Local development may use HTTP."}
          </p>
        </section>

        <section>
          <h2 className="text-headline-md font-headline-md text-emerald-glow mb-3 font-semibold">
            {lang === "uk" ? "5. Ваші права" : "5. Your Rights"}
          </h2>
          <p>
            {lang === "uk"
              ? "Ви маєте повне право видалити свою локальну історію в один клік у розділі «Історія перевірок», а також звернутися до нас для видалення вашого облікового запису в будь-який момент."
              : "You have full control to clear your scan history anytime in one click, and can request full deletion of your user account upon request."}
          </p>
        </section>
      </div>
    </div>
  );
}
