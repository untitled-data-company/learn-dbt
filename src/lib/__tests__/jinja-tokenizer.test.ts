import { describe, it, expect } from "vitest";
import {
  sqlJinjaTokenizer,
  JINJA_KEYWORDS,
  JINJA_BUILTINS,
} from "@/lib/jinja-tokenizer";

/**
 * Normalises a rule's regex field to its string source. The tokenizer
 * stores some regexes as string literals and others as RegExp objects;
 * tests need a consistent representation.
 */
function regexSource(rule: { regex?: string | RegExp }): string {
  if (!rule.regex) return "";
  return typeof rule.regex === "string"
    ? rule.regex
    : rule.regex.source;
}

describe("sqlJinjaTokenizer", () => {
  describe("structure", () => {
    it("is a valid Monarch language object", () => {
      expect(sqlJinjaTokenizer.defaultToken).toBeDefined();
      expect(sqlJinjaTokenizer.tokenPostfix).toBe(".sql");
      expect(sqlJinjaTokenizer.ignoreCase).toBe(true);
      expect(Array.isArray(sqlJinjaTokenizer.starts)).toBe(true);
      expect(sqlJinjaTokenizer.starts.length).toBeGreaterThan(0);
    });

    it("has keywords array for SQL", () => {
      expect(Array.isArray(sqlJinjaTokenizer.keywords)).toBe(true);
      expect(sqlJinjaTokenizer.keywords).toContain("SELECT");
      expect(sqlJinjaTokenizer.keywords).toContain("FROM");
      expect(sqlJinjaTokenizer.keywords).toContain("JOIN");
      expect(sqlJinjaTokenizer.keywords).toContain("CASE");
    });
  });

  describe("Jinja expression entry rules", () => {
    it("has a rule that matches {{ and pushes to jinja-expression", () => {
      const exprRule = sqlJinjaTokenizer.starts.find(
        (r) => r.regex === "{{",
      );
      expect(exprRule).toBeDefined();
      expect(exprRule!.token).toBe("delimiter.jinja");
      expect(exprRule!.push).toBe("jinja-expression");
    });

    it("has a rule that matches {% and pushes to jinja-statement", () => {
      const stmtRule = sqlJinjaTokenizer.starts.find(
        (r) => r.regex === "{%",
      );
      expect(stmtRule).toBeDefined();
      expect(stmtRule!.token).toBe("delimiter.jinja");
      expect(stmtRule!.push).toBe("jinja-statement");
    });

    it("has a rule that matches {# and pushes to jinja-comment", () => {
      const commentRule = sqlJinjaTokenizer.starts.find(
        (r) => r.regex === "{#",
      );
      expect(commentRule).toBeDefined();
      expect(commentRule!.token).toBe("comment.jinja");
      expect(commentRule!.push).toBe("jinja-comment");
    });
  });

  describe("jinja-expression sub-state", () => {
    const exprState = sqlJinjaTokenizer[
      "jinja-expression"
    ] as typeof sqlJinjaTokenizer.starts;

    it("has a pop rule for }}", () => {
      const popRule = exprState.find((r) => r.regex === "}}");
      expect(popRule).toBeDefined();
      expect(popRule!.next).toBe("@pop");
    });

    it("highlights Jinja builtins (ref, source, config) with keyword.builtin.jinja token", () => {
      const builtinRule = exprState.find(
        (r) => r.token === "keyword.builtin.jinja",
      );
      expect(builtinRule).toBeDefined();
      const regexStr = regexSource(builtinRule!);
      // Each builtin should appear in the regex
      for (const b of ["ref", "source", "config"]) {
        expect(regexStr).toContain(b);
      }
    });

    it("has string rules for single and double quotes", () => {
      const singleQuote = exprState.find(
        (r) =>
          r.token === "string.jinja" &&
          regexSource(r) === /'[^']*'/.source,
      );
      const doubleQuote = exprState.find(
        (r) =>
          r.token === "string.jinja" &&
          regexSource(r) === /"[^"]*"/.source,
      );
      expect(singleQuote).toBeDefined();
      expect(doubleQuote).toBeDefined();
    });
  });

  describe("jinja-statement sub-state", () => {
    const stmtState = sqlJinjaTokenizer[
      "jinja-statement"
    ] as typeof sqlJinjaTokenizer.starts;

    it("has a pop rule for %}", () => {
      const popRule = stmtState.find((r) => r.regex === "%}");
      expect(popRule).toBeDefined();
      expect(popRule!.next).toBe("@pop");
    });

    it("highlights Jinja control keywords (if, for, macro, etc.) with keyword.control.jinja token", () => {
      const controlRule = stmtState.find(
        (r) => r.token === "keyword.control.jinja",
      );
      expect(controlRule).toBeDefined();
      const regexStr = regexSource(controlRule!);
      for (const kw of ["if", "for", "macro", "endif", "endfor"]) {
        expect(regexStr).toContain(kw);
      }
    });
  });

  describe("jinja-comment sub-state", () => {
    const commentState = sqlJinjaTokenizer[
      "jinja-comment"
    ] as typeof sqlJinjaTokenizer.starts;

    it("has a pop rule for #}", () => {
      const popRule = commentState.find((r) => r.regex === "#}");
      expect(popRule).toBeDefined();
      expect(popRule!.next).toBe("@pop");
    });

    it("consumes all non-# characters as comment", () => {
      const consumeRule = commentState.find(
        (r) => r.token === "comment.jinja" && regexSource(r) === /[^#]+/.source,
      );
      expect(consumeRule).toBeDefined();
    });
  });

  describe("SQL fallthrough rules", () => {
    it("has SQL single-line comment rule (--)", () => {
      const sqlComment = sqlJinjaTokenizer.starts.find(
        (r) => r.token === "comment" && regexSource(r) === /--.*$/.source,
      );
      expect(sqlComment).toBeDefined();
    });

    it("has SQL block comment start (/*) that pushes to sql-comment", () => {
      const blockStart = sqlJinjaTokenizer.starts.find(
        (r) => r.token === "comment" && regexSource(r) === /\/\*/.source,
      );
      expect(blockStart).toBeDefined();
      expect(blockStart!.push).toBe("sql-comment");
    });

    it("has string start rules for single and double quotes", () => {
      const single = sqlJinjaTokenizer.starts.find(
        (r) => r.token === "string" && regexSource(r) === /'/.source,
      );
      const double = sqlJinjaTokenizer.starts.find(
        (r) => r.token === "string" && regexSource(r) === /"/.source,
      );
      expect(single).toBeDefined();
      expect(single!.push).toBe("sql-string-single");
      expect(double).toBeDefined();
      expect(double!.push).toBe("sql-string-double");
    });

    it("has number rule", () => {
      const number = sqlJinjaTokenizer.starts.find(
        (r) => r.token === "number",
      );
      expect(number).toBeDefined();
    });
  });
});

describe("JINJA_KEYWORDS", () => {
  it("includes core Jinja control flow keywords", () => {
    expect(JINJA_KEYWORDS).toContain("if");
    expect(JINJA_KEYWORDS).toContain("elif");
    expect(JINJA_KEYWORDS).toContain("else");
    expect(JINJA_KEYWORDS).toContain("endif");
    expect(JINJA_KEYWORDS).toContain("for");
    expect(JINJA_KEYWORDS).toContain("endfor");
  });

  it("includes macro and set keywords", () => {
    expect(JINJA_KEYWORDS).toContain("macro");
    expect(JINJA_KEYWORDS).toContain("endmacro");
    expect(JINJA_KEYWORDS).toContain("set");
  });
});

describe("JINJA_BUILTINS", () => {
  it("includes dbt core builtins", () => {
    expect(JINJA_BUILTINS).toContain("ref");
    expect(JINJA_BUILTINS).toContain("source");
    expect(JINJA_BUILTINS).toContain("config");
    expect(JINJA_BUILTINS).toContain("var");
  });

  it("does not duplicate keywords", () => {
    const unique = new Set(JINJA_BUILTINS);
    expect(unique.size).toBe(JINJA_BUILTINS.length);
  });
});

describe("Jinja keyword/builtin regex validity", () => {
  it("jinja-statement control regex compiles", () => {
    const stmtState = sqlJinjaTokenizer[
      "jinja-statement"
    ] as typeof sqlJinjaTokenizer.starts;
    const controlRule = stmtState.find(
      (r) => r.token === "keyword.control.jinja",
    );
    expect(() => new RegExp(regexSource(controlRule!))).not.toThrow();
  });

  it("jinja-expression builtin regex compiles", () => {
    const exprState = sqlJinjaTokenizer[
      "jinja-expression"
    ] as typeof sqlJinjaTokenizer.starts;
    const builtinRule = exprState.find(
      (r) => r.token === "keyword.builtin.jinja",
    );
    expect(() => new RegExp(regexSource(builtinRule!))).not.toThrow();
  });

  it("all regex patterns in the tokenizer compile", () => {
    const allStates = [
      sqlJinjaTokenizer.starts,
      sqlJinjaTokenizer["jinja-expression"] as typeof sqlJinjaTokenizer.starts,
      sqlJinjaTokenizer["jinja-statement"] as typeof sqlJinjaTokenizer.starts,
      sqlJinjaTokenizer["jinja-comment"] as typeof sqlJinjaTokenizer.starts,
      sqlJinjaTokenizer["sql-comment"] as typeof sqlJinjaTokenizer.starts,
      sqlJinjaTokenizer[
        "sql-string-single"
      ] as typeof sqlJinjaTokenizer.starts,
      sqlJinjaTokenizer[
        "sql-string-double"
      ] as typeof sqlJinjaTokenizer.starts,
    ];
    for (const state of allStates) {
      for (const rule of state) {
        const src = regexSource(rule);
        if (src) {
          expect(() => new RegExp(src)).not.toThrow();
        }
      }
    }
  });
});