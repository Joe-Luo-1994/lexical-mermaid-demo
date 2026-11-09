import {Plugin} from '@opencode/plugin';
import {Schema} from 'effect';
import {realpath} from 'node:fs/promises';
import {isAbsolute, relative, resolve} from 'node:path';
import {queryFile} from '../../scripts/report-query.mjs';

// OpenCode 2.2.5 Promise Plugin API. Opt in via `plugins` config.
// Kept outside .opencode/plugins so cloning this repository has no plugin side effect.
export default Plugin.define({
  id: 'editor-evidence',
  async setup(ctx) {
    const root = await realpath(ctx.location.directory);
    const registration = await ctx.tool.transform(tools => {
      tools.add({
        name: 'editor-evidence',
        options: {codemode: false},
        description: 'Read a bounded summary or one event from a schemaVersion 1 editor recording within this project location. No shell, browser, upload or messages. Findings are stored assertions: inspect cited events before trusting conclusions.',
        input: Schema.Struct({
          file: Schema.String,
          eventId: Schema.optional(Schema.String),
          limit: Schema.optional(Schema.Number),
        }),
        async execute(args) {
          try {
            const file = await realpath(resolve(root,args.file));
            const delta = relative(root,file);
            if (delta === '..' || delta.startsWith('../') || delta.startsWith('..\\') || isAbsolute(delta)) {
              return {content:JSON.stringify({error:'Recording must be inside the active OpenCode location. Copy the JSON into this project and retry.'})};
            }
            return {content:await queryFile(file,{eventId:args.eventId,limit:args.limit})};
          } catch (error) {
            return {content:JSON.stringify({error:error instanceof Error?error.message:String(error),next:'Check the path, schemaVersion 1 format and event ID. Raw Chrome traces are not accepted.'})};
          }
        },
      });
    });
    return () => registration.dispose();
  },
});
