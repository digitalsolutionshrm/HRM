<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Environment configuration

Create a local environment file before starting the server:

```powershell
Copy-Item .env.example .env
```

Set the database username, password, and database name in `.env`. Generate two
different JWT secrets and set `JWT_SECRET` and `JWT_REFRESH_SECRET`:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Run that command twice and use each generated value for one of the JWT secrets.
Do not commit `.env` or use the example’s blank secrets in production.

## Notifications

Notifications are stored in PostgreSQL and are always scoped to the signed-in
recipient. Email is disabled unless `NOTIFICATIONS_EMAIL_ENABLED=true`; the
existing `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASSWORD`, `MAIL_SECURE`,
and `MAIL_FROM` settings are used when it is enabled. Failed optional email does
not remove the in-app notification.

The app currently has no organization/tenant entity, so it is treated as one
organization. Admin and HR users can create announcements and target the current
users, roles, departments, or selected user IDs. Add a tenant model and include
its ID in the authenticated user before using this in a multi-organization app.

Authenticated notification routes:

- `GET /api/notifications?page=1&limit=20&type=LEAVE&isRead=false`
- `GET /api/notifications/unread-count`
- `GET /api/notifications/:id`
- `PATCH /api/notifications/:id/read` and `/unread`
- `PATCH /api/notifications/read-all`
- `DELETE /api/notifications/:id` and `DELETE /api/notifications/read`
- `POST /api/notifications/announcements`

Example announcement body:

```json
{
  "title": "Office closed Friday",
  "message": "The office will be closed on Friday.",
  "roles": ["employee", "manager"]
}
```

Example history request: `GET /api/notifications?page=1&limit=20&isRead=false`.
Expected response shape:

```json
{
  "success": true,
  "data": {
    "items": [],
    "total": 0,
    "page": 1,
    "limit": 20
  }
}
```

Responses use the existing `{ "success": true, "data": ... }` wrapper. The
list `data` contains `items`, `total`, `page`, and `limit`. For example, a list
response contains `data.items` (each item includes its ID, category, title,
message, read state, and creation time) and `data.total` for pagination. The
Socket.IO server authenticates with the same access token as REST and emits
`notification:history`, `notification:new`, `notification:read`,
`notification:deleted`, `notification:read-all`, and
`notification:unread-count`. Clients never select room names or user IDs.

Use `npm run migration:run` to apply the notification columns and indexes. The
app now disables TypeORM synchronization in production while retaining it for
development. Run migrations as part of deployment before starting the updated
server. This notification migration assumes the existing HRM tables are already
present; a brand-new database still needs baseline migrations for the other
modules. Socket.IO runs in-process and does not need Redis for a single backend
instance. Multi-instance fanout would need a shared adapter.
No queue is configured, so optional email failures are recorded as unsent but
are not retried automatically.

The notification ownership and pagination checks should be covered for: another
user's ID returning 404, read/delete changing only the owner's record, unread
counts matching filtered state, category/read filters and page boundaries, and
dedupe keys creating one row per user. Announcement tests should cover HR/Admin
access and department/role/user targeting. Socket tests should cover invalid or
expired JWTs, revoked sessions, private user rooms, reconnect history, and
read/delete synchronization. Email tests should confirm the default-off setting
and that an enabled send failure leaves the in-app row saved.

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
