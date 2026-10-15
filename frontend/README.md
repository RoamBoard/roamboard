# Roamboard frontend

This is the Next.js App Router frontend. Use pnpm in this directory.

## Local development

Create `frontend/.env.local` with the Google web client ID from Google Auth
Platform and the local Express URL:

```env
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
NEXT_PUBLIC_API_URL=http://localhost:3001
```

In Google Auth Platform, authorize `http://localhost:3000` as a JavaScript
origin for that web client. The backend uses the same client ID in its own
`GOOGLE_CLIENT_ID` setting and must set `CLIENT_ORIGIN=http://localhost:3000`.
Do not put the Google client secret in frontend files. `.env.local` is ignored
by Git; restart the frontend after changing it.

Run `pnpm install` and `pnpm dev` here, then open
[http://localhost:3000/login](http://localhost:3000/login). The Google button
posts its ID token to Express. The frontend sends the resulting session cookie
on API requests. See `../backend/README.md` for the API and migration setup.

Before submitting frontend changes, run `pnpm lint`, `pnpm exec tsc --noEmit`,
and `pnpm build`.

The existing `/dev/providers`, Home destination search, `/dev/profile`,
`/dev/boards` and Board creator use the new backend and the same
`NEXT_PUBLIC_API_URL` with session cookies. Start the backend with `npm run dev`
and sign in before using developer management tools. Apply backend migration 004
through the team workflow and configure provider keys; see
[the API feature contract](../backend/API_FEATURES_CONTRACT.md). Provider lab
uploads remain separate from persisted Board uploads. Profile pictures accept
an owned uploaded image ID from the normal upload flow.

## Learn more

- [Next.js documentation](https://nextjs.org/docs) covers App Router features and APIs.
- [Learn Next.js](https://nextjs.org/learn) is an interactive tutorial.
- [Next.js on GitHub](https://github.com/vercel/next.js) has the framework source and issue tracker.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the
[Vercel Platform](https://vercel.com/new) from the creators of Next.js.

Check out the
[Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying)
for more details. Configure the frontend and backend URLs and Google client ID
for that environment before deploying.
