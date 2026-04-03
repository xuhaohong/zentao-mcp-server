# Child Task Contract Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove the ambiguous `execution` input from child task creation and always derive the real execution from the parent task, with optional `storyId` passthrough only when explicitly provided.

**Architecture:** Keep the public MCP tool thin. Move the real execution resolution into `ZenTaoClient.createChildTask()` by loading the parent task first, then create the task under the parent's execution and patch the parent relation afterward. Sync the README and tool schema to the new breaking contract.

**Tech Stack:** TypeScript, MCP SDK, native `fetch`, existing ZenTao REST/Web APIs

---

### Task 1: Update Child Task Types And Tool Schema

**Files:**
- Modify: `src/types/zentao.ts`
- Modify: `src/tools/task-tools.ts`

**Step 1: Update the child-task input type**

Change `CreateChildTaskInput` so it removes `execution` and adds optional `story`.

**Step 2: Update the MCP tool schema**

Change `zentao_create_child_task` to:
- remove `execution`
- add optional `storyId`
- update the description to say execution is resolved from the parent task

**Step 3: Map `storyId` to client input**

When calling `client.createChildTask()`, map `storyId` to `story` and keep the existing date defaults.

**Step 4: Run build**

Run: `npm run build`
Expected: PASS

### Task 2: Rework Child Task Creation Flow In Client

**Files:**
- Modify: `src/clients/zentao-client.ts`

**Step 1: Resolve execution from the parent task**

Inside `createChildTask()`:
- load the parent task with `getTask(parent)`
- read `execution` from the parent task
- validate it is a positive number

**Step 2: Create under the resolved execution**

Call the execution task creation endpoint directly using the resolved execution ID, not the removed external parameter.

**Step 3: Pass story only when explicitly provided**

Include `story` in the creation body only if the caller supplied it.

**Step 4: Keep parent patching**

Reuse `legacySetParent()` after creation, then refetch the final task detail.

**Step 5: Improve error messages**

Add explicit errors for:
- missing parent task detail
- missing parent execution
- create succeeded but parent patch failed

**Step 6: Run build**

Run: `npm run build`
Expected: PASS

### Task 3: Sync Public Documentation

**Files:**
- Modify: `README.md`

**Step 1: Fix the tool list**

Replace stale tool names with the actual registered tools.

**Step 2: Document the breaking child-task contract**

State that:
- `execution` is no longer accepted
- execution is resolved from the parent task
- `storyId` is optional
- `storyId` is never inherited from the parent

**Step 3: Run build**

Run: `npm run build`
Expected: PASS

### Task 4: Validate Against Real ZenTao Behavior

**Files:**
- Modify: `src/clients/zentao-client.ts` (if probe results require a follow-up tweak)

**Step 1: Create a temporary child task without story**

Use project `22`, parent task `20558`, no `storyId`.

Expected:
- task is created successfully
- final detail shows `project=22`, `execution=23`
- task is deletable

**Step 2: Create a temporary child task with story**

Use the same parent and an explicit `storyId`.

Expected:
- task is created successfully
- final detail still shows `execution=23`
- story is present only because it was explicitly passed
- task is deletable

**Step 3: Clean up**

Delete all temporary tasks created during validation.

**Step 4: Record any remaining API quirks**

If ZenTao still returns inconsistent create payloads, keep the final implementation based on the refetched task detail rather than the raw create response.
