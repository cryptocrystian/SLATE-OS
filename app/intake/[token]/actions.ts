"use server";

import {
  submitStakeholderResponses,
  type SubmitResponsesResult,
} from "@/lib/intake/public";

export interface PublicSubmitInput {
  token: string;
  answers: Array<{ questionId: string; questionLabel: string; answerText: string }>;
}

export async function submitPublicIntake(
  input: PublicSubmitInput,
): Promise<SubmitResponsesResult> {
  return submitStakeholderResponses({
    rawToken: input.token,
    answers: input.answers,
  });
}
