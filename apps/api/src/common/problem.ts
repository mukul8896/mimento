import { HttpException } from '@nestjs/common';

export interface ProblemIssue {
  stepKey: string | null;
  field: string | null;
  message: string;
}

/**
 * Domain error rendered as RFC 9457 problem details by ProblemFilter.
 * `code` is a stable machine-readable identifier the web app can branch on.
 */
export class Problem extends HttpException {
  constructor(
    readonly httpStatus: number,
    readonly code: string,
    readonly title: string,
    readonly detail?: string,
    readonly issues?: ProblemIssue[],
  ) {
    super({ code, title, detail }, httpStatus);
  }

  static notFound(what = 'Resource'): Problem {
    return new Problem(404, 'NOT_FOUND', `${what} not found`);
  }
  static badRequest(code: string, title: string, detail?: string): Problem {
    return new Problem(400, code, title, detail);
  }
  static conflict(code: string, title: string, detail?: string): Problem {
    return new Problem(409, code, title, detail);
  }
  static forbidden(code = 'FORBIDDEN', title = 'Forbidden'): Problem {
    return new Problem(403, code, title);
  }
  static unauthorized(): Problem {
    return new Problem(401, 'UNAUTHORIZED', 'Authentication required');
  }
  static unprocessable(code: string, title: string, issues?: ProblemIssue[]): Problem {
    return new Problem(422, code, title, undefined, issues);
  }
  /**
   * Public recipient endpoints use one neutral error for every unavailable state
   * (unknown token, unpublished, disabled, expired, deleted, taken down) so that callers
   * cannot tell whether a token ever existed.
   */
  static unavailable(): Problem {
    return new Problem(404, 'EXPERIENCE_UNAVAILABLE', 'This experience is not available');
  }
}
