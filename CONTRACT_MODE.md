# Contract mode

Use this guide whenever someone asks to **enter contract mode for a feature**. The goal is a contract that the frontend and backend teammates understand and approve before they implement against it. This mode is for research, questions, and a shared Markdown contract. It does not start feature implementation unless the user separately asks for that work.

## How to start

Example: **"Enter contract mode for Profile. Alex is handling frontend; Teoman is handling backend."**

If the feature or participants are not named, ask only for information needed to begin. One person may start the session; record their decisions as proposed until the other teammate reviews them. Do not claim to have heard from an absent teammate. A teammate may explicitly delegate decisions to the other.

## 1. Gather evidence before interviewing

Read only the material relevant to this feature:

- Product requirements, approved designs, previous decisions, and existing contracts.
- Frontend routes, components, types, mock data, and actual network calls.
- Backend routes, services, migrations, constraints, and tests from the relevant branch. Inspect relevant unmerged branch work without overwriting the current worktree.

Distinguish **implemented**, **mocked**, **documented intention**, and **unresolved** behavior. Record the branch and file paths used. Current teammate decisions and an approved contract outrank older drafts; existing code and SQL show what is implemented, but neither automatically dictates the desired UX. If sources disagree, show the conflict with a concrete example and ask which behavior the team wants. Do not silently change a design to fit a table or invent a database field to fit a mock.

Start the discussion with a brief evidence summary: what exists, what the feature is meant to do, and the few decisions that block a contract. Do not dump every question at once.

## 2. Interview the teammates

Ask **one decision at a time**, in plain language. Say why it matters for the frontend/backend boundary. Where useful, give a small example and two or three mutually exclusive options; recommend one only when evidence supports it. Wait for the answer before asking a dependent question. After each answer, restate the decision and its effect in one or two sentences so either teammate can correct it.

Cover the topics that affect this feature, without mechanically asking irrelevant questions:

1. **Scope and user journey:** what action starts the feature, what counts as success, and what belongs in a later slice?
2. **Actors and access:** anonymous, owner, friend, member, editor, viewer; who may read, create, change, delete, or share each resource?
3. **Data:** fields, types, required/optional/null behavior, defaults, identifiers, relationships, and who supplies each value.
4. **Lifecycle:** create, edit, delete, ordering, duplication, state transitions, and what happens to dependent data.
5. **Frontend behavior:** loading, empty, validation, permission, and failure states; which current controls are real, mocked, or unsupported? Ask about UX only where it changes contract behavior. Do not prescribe visual layout or wording from a database column name.
6. **API behavior:** endpoints, request and response examples, pagination/filtering where needed, errors, authentication, CSRF protection for cookie-based writes, and authorization.
7. **Integration boundaries:** file uploads, external providers, transactions, and features that require a new migration or another contract.

Use concrete scenarios to expose gaps: a new user, a returning user, an unauthorized viewer, an invalid input, a deleted or inaccessible resource, and simultaneous edits when relevant. Ask a follow-up when an answer conflicts with another decision. Do not mark a conflict resolved merely because one side is easier to implement.

Keep a short decision log as the interview proceeds. Mark each point **agreed**, **proposed by frontend**, **proposed by backend**, or **open**. If only one teammate is present, continue useful drafting but keep the contract in review status. If the teammates disagree, describe the options and trade-offs, ask them to choose, and continue with independent parts of the contract.

## 3. Write the shared contract

Update an existing feature contract if there is one; otherwise create `contracts/<feature>.md` at the repository root. Do not overwrite a teammate's unrelated draft. Use this outline, omitting sections that truly do not apply:

```text
# <Feature> contract
Status: Draft | Pending frontend review | Pending backend review | Agreed
Owners/reviewers and branch/source references

Goal and first-version scope
Out of scope for this version
Agreed user journeys and permission matrix
Data fields, identifiers, defaults, validation, and persistence
Endpoints: method/path, authentication, request, response, errors
Worked examples for success and important failures
Frontend behavior and mapping from existing UI
Backend storage and migration implications
Open questions and decision log
Approval record (who agreed and when)
```

Keep the API contract independent of internal table names unless those names explain a constraint. Use the existing `/api/v1` prefix, `{ "data": ... }` success envelope, and `{ "error": { "code": "...", "message": "..." } }` error envelope unless the team agrees to change them. Include example JSON that parses. Define what omitted, `null`, and empty values mean. State what is **not implemented** so a frontend preview cannot be mistaken for persistence.

Check the proposed contract against the current schema and frontend. List changes required on each side, but do not silently remove desired UX. If the desired behavior needs a new field or table, record the migration needed. If a feature is postponed, say what the UI should do until it exists.

## 4. Review and close

Before requesting agreement, show a concise summary of the completed contract and the exact open decisions. Then ask both teammates to review the **concrete document**, including request/response examples and the frontend/backend change list. If the user is explicitly speaking for both, record that. Do not mark a contract **Agreed** until both sides have accepted it or delegated that decision.

After agreement, update its status and approval record. Implementation can then proceed in separate frontend and backend work using the same document. When a decision changes, update the contract and decision log first, tell both sides what changed, and update affected code or tests as part of the implementation task. Never present a draft contract or a passing mock as an implemented feature.

Stop the interview when the contract is implementable and the remaining questions are clearly marked for later slices. Thoroughness means resolving consequential ambiguity, not asking about every hypothetical feature.
