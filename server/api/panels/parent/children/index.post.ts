import type { ChildCreatedResponse } from "~/types/parent-panel";

/**
 * `POST /panels/parent/child/create`
 *
 * The only response in the whole panel that carries a code VALUE together with a
 * `userId`, and the only moment a parent ever sees one for a new child. It is
 * returned **raw** so both survive in a single request — refetching
 * `/child/list` would race the create and still not produce the code, which
 * upstream stores once and never projects again.
 *
 * ## ⚠ `avatar` IS DELIBERATELY NOT FORWARDED — THIS PROXY IS THE ENFORCEMENT POINT
 *
 * `createChildSchema` accepts `avatar` only when it matches
 * `/^\/uploads\/[\w./-]+$/` (`panels.validation.ts:174-199`), i.e. the shape the
 * server's own upload pipeline produces. Everything this app has for a child is a
 * local `public/` path, so forwarding one is a guaranteed `ERR_VALIDATION`, and
 * `POST /user/avatar` writes to the SIGNED-IN PARENT, never to a child — there is
 * no way to set a child's avatar from this repo at all. The body is therefore
 * re-shaped to the four fields a parent can actually supply, and the card's null
 * branch is what renders.
 *
 * Everything else is upstream's to validate: `birthDate` is an epoch-ms integer
 * bounded at 1900 and at now, `gender` is a `male|female|other` enum. Duplicating
 * those rules here would be a second validator to keep in step with the first.
 */
interface CreateChildBody {
  firstName: string;
  lastName: string;
  birthDate: number;
  gender: string;
}

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<Partial<CreateChildBody>>(event);

    return (await api(event, PARENT_COOKIE)("/panels/parent/child/create", {
      method: "post",
      body: {
        firstName: body?.firstName,
        lastName: body?.lastName,
        birthDate: body?.birthDate,
        gender: body?.gender,
      },
    })) as ChildCreatedResponse;
  } catch (err) {
    return connectionResponseError();
  }
});
