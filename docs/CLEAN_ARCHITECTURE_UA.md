# Організація коду

Структуру оновлено 22 жовтня 2026 року. Це опис реалізації, а не план майбутнього переписування.

## Шари сервера

```text
src/server/
  index.ts                    запуск HTTP-сервера
  domain/
    users/                    сутність User, типи користувача, порти сховища та паролів
    analysis/                 правила зіставлення, ШІ-ознаки, підготовка тексту, порти
    documents/                вирівнювання тексту
    utils/                    чисті текстові утиліти
  application/
    auth/                     AuthenticationService, GoogleSignInService
    scanning/                 ScanService, обчислення підсумку
    ai/                       AiAssessmentService, ProviderRegistry
    humanization/             перетворення тексту за правилами
  infrastructure/
    auth/                     bcrypt, JWT, секрет сесії, Google OAuth API
    persistence/              PersistentUserRepository, ReportRepository, Redis
    search/                   вебпошук, читання сторінок, черги, circuit breaker
    ai/                       адаптери NVIDIA NIM та OpenRouter
    documents/                читання й формування файлів
    cache/                    кеш пошуку та сховище завдань
    config/                   дозволені адреси клієнта
  presentation/http/
    app.ts                    складання HTTP-маршрутів
    routes/                   авторизація, історія, редагування тексту
    middleware/               перевірка сесії, обмеження запитів
    validation/               Zod-схеми вхідних даних
    auth/                     cookie та OAuth state
  composition/                створення й з’єднання конкретних залежностей
  types/                      винесені контракти та декларації
```

`domain` і `application` не імпортують `infrastructure`, `presentation` або `composition`. Прикладний сервіс залежить від порту, а конкретний адаптер передається через конструктор. Цю межу перевіряє автоматичний тест. HTTP-шар знає про Express і cookie; бізнес-правила цього не потребують.

Сутність `User` перевіряє дані створення, репозиторій відповідає за доступ до сховища, `AuthenticationService` — за сценарій реєстрації/входу. Класи використано там, де потрібні залежності, стан або інваріанти. Чисті алгоритми токенізації, обчислення збігів і перетворення тексту залишаються утилітними функціями.

## Пароль і сесія

1. HTTP-маршрут один раз перевіряє тіло запиту через Zod. Ліміт спроб і схеми розміщено в окремих файлах.
2. `AuthenticationService.register` перевіряє зайнятість email і викликає `BcryptPasswordHasher.hash`.
3. `PersistentUserRepository.create` отримує `NewUserData` із `passwordHash`, без поля `password`. `User.create` створює сутність; репозиторій зберігає її запис.
4. Під час парольного входу хеш перевіряється один раз. Google-акаунт без локального пароля має явне `passwordHash: null`, а не невизначене значення. Вхід через Google не вигадує користувачу пароль і не стирає хеш під час прив’язування акаунта.
5. `TokenService` генерує і перевіряє JWT. Налаштування секрету знаходяться в інфраструктурі авторизації. `SessionCookie` окремо встановлює/видаляє HTTP-only cookie на 30 днів.
6. Відсутня сесія дозволяє гостьові сценарії. Переданий недійсний токен дає `401 SESSION_INVALID` і очищення cookie. Клієнтський `apiFetch` повідомляє про подію; `useAuth` очищає стан, а `SessionRedirect` виконує перехід на `/login`. Помилка введеного пароля залишається у формі входу.

Google OAuth розділено на перевірку state/cookie в HTTP-шарі, обмін коду на підтверджений профіль у `GoogleOAuthClient` та пошук/прив’язування користувача в `GoogleSignInService`.

## Провайдери та кеш

`ProviderRegistry` зберігає адаптери за унікальним ідентифікатором і явним пріоритетом. `AiAssessmentService` перебирає зареєстровані адаптери та застосовує резервний провайдер. Конкретні NVIDIA/OpenRouter-класи створюються в `composition/ai.ts`.

Кеш користувачів — `Map<string, UserRecord>`, тобто містить об’єкти користувачів. Окремі індекси email/Google ID містять ідентифікатори. Серіалізація JSON потрібна лише на межі файлового/Redis-сховища. Пам’ять процесу не є постійною базою: перезапуск очищає її; сталість залежить від файлів або Redis.

## Клієнт, контракти та перевірки

- `src/client/components`, `pages`, `hooks`, `context`, `utils` — інтерфейс і клієнтська поведінка.
- `src/client/styles` — CSS; `src/client/types` — винесені інтерфейси й типи компонентів.
- `src/shared/types` — спільні API-контракти, `src/shared/validation` — спільні схеми.
- `tests/unit/client`, `tests/unit/server` — модульні та API-регресії; `tests/setup` — їх налаштування; `tests/e2e` — браузерні сценарії.

Команди перевірки: `npm test`, `npm run lint`, `npm run build`. Vercel-адаптер `api/[...path].js` імпортує скомпільований HTTP-модуль із `.vercel-server/server/presentation/http/app.js`.

Рефакторинг не калібрує ШІ-оцінку, не змінює формулу дослівних збігів і не перетворює файловий кеш на постійну базу Vercel. Реальний Google OAuth і збереження сесії після закриття браузера потребують окремої перевірки на розгорнутому сайті.

## Діаграми

[Архітектура](diagrams/architecture.md) та [послідовності](diagrams/sequences.md) наведені окремими невеликими Mermaid-діаграмами. Діаграма шарів показує залежності коду, а діаграми послідовностей — порядок дій під час запиту.
