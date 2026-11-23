import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { UPLOAD_ROUTE_MAX_DURATION_SEC } from '@/lib/upload-config';

const UPLOAD_ROUTES = [
  'app/api/upload-drive/route.ts',
  'app/api/upload-media/route.ts',
  'app/api/upload-mixcloud/route.ts',
];

function maxDurationInitializer(source: string): ts.Expression | undefined {
  const file = ts.createSourceFile('route.ts', source, ts.ScriptTarget.Latest, true);
  for (const statement of file.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    if (!statement.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === 'maxDuration') {
        return declaration.initializer;
      }
    }
  }
}

describe('upload route maxDuration', () => {
  for (const route of UPLOAD_ROUTES) {
    it(`${route} exports the upload budget as a number literal`, () => {
      const initializer = maxDurationInitializer(readFileSync(route, 'utf8'));
      expect(initializer && ts.isNumericLiteral(initializer)).toBe(true);
      expect(Number((initializer as ts.NumericLiteral).text)).toBe(UPLOAD_ROUTE_MAX_DURATION_SEC);
    });
  }
});
