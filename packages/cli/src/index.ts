import { createProgram } from "./program.js";
import { handleError } from "./errors.js";

const program = createProgram();

program.parseAsync(process.argv).catch(handleError);
