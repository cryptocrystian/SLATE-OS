"use server";

import { revalidatePath } from "next/cache";
import * as service from "./service";
import type { ProjectStatus, WorkItemStatus } from "./types";

/**
 * BuildOS operator server actions. BUILDOS MODULE.
 *
 * Thin wrappers: validation, authorization, writes and audit live in
 * service.ts. These only add cache revalidation for the /app/build tree.
 */

const ROOT = "/app/build";

function done<T extends { ok: boolean }>(result: T): T {
  if (result.ok) revalidatePath(ROOT, "layout");
  return result;
}

export async function createProjectAction(input: Record<string, unknown>) {
  return done(await service.createProject(input));
}

export async function transitionProjectAction(projectId: string, to: ProjectStatus, reason: string) {
  return done(await service.transitionProject(projectId, to, reason));
}

export async function updateProjectSettingsAction(projectId: string, input: Record<string, unknown>) {
  return done(await service.updateProjectSettings(projectId, input));
}

export async function createWorkItemAction(projectId: string, input: Record<string, unknown>) {
  return done(await service.createWorkItem(projectId, input));
}

export async function transitionWorkItemAction(itemId: string, to: WorkItemStatus, reason: string) {
  return done(await service.transitionWorkItem(itemId, to, reason));
}

export async function ruleDecisionAction(decisionId: string, input: Record<string, unknown>) {
  return done(await service.ruleDecision(decisionId, input));
}

export async function requestRunCancelAction(runId: string) {
  return done(await service.requestRunCancel(runId));
}

export async function clearAlarmAction(alarmId: string) {
  return done(await service.clearAlarm(alarmId));
}

export async function evaluateAlarmsAction() {
  return done(await service.evaluateAlarms());
}

export async function createProviderAccountAction(input: Record<string, unknown>) {
  return done(await service.createProviderAccount(input));
}

export async function setProviderAccountStatusAction(accountId: string, status: "active" | "disabled") {
  return done(await service.setProviderAccountStatus(accountId, status));
}

export async function registerWorkerAction(input: Record<string, unknown>) {
  return done(await service.registerWorker(input));
}

export async function setWorkerStatusAction(workerId: string, status: "active" | "disabled") {
  return done(await service.setWorkerStatus(workerId, status));
}
