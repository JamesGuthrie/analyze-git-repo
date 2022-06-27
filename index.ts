import { Octokit } from "https://esm.sh/octokit";
import postgres from "https://deno.land/x/postgresjs/mod.js";

const REPO_OWNER = "timescale";
const REPO = "promscale_extension";

let login = async (): Promise<Octokit> => {
  const TOKEN = Deno.env.get("GH_API_TOKEN");
  const octokit = new Octokit({ auth: TOKEN });

  await octokit.rest.users.getAuthenticated();
  console.log(`logged in as ${login}`);
  return octokit;
}

let connect = async (): Promise<postgres.Sql<any>> => {
  return postgres();
}

let windowify = <T>(items: Array<T>, size: number = 1): Array<Array<T>> => {
  items = [...items];
  let result: Array<Array<T>> = [];
  while (items.length > 0) {
    result.push(items.splice(0, size));
  }
  return result;
};

let getWorkflowPage = async (octokit: Octokit, per_page: number, page: number = 1) => {
  console.log(`Getting ${per_page} items on page ${page}`);
  return await octokit.request('GET /repos/{REPO_OWNER}/{REPO}/actions/runs', {
    REPO_OWNER,
    REPO,
    per_page,
    page
  });
}

interface Workflow {
  data: any;
}

let writeWorkflows = async (sql: postgres.Sql<any>, data: Array<Workflow>) => {
    await sql`INSERT INTO workflows ${sql(data, 'data')}`;
}

let createOrTruncateTable = async(client: postgres.Sql<any>) => {
    await sql`CREATE TABLE IF NOT EXISTS workflows(data JSONB NOT NULL)`;
    await sql`TRUNCATE TABLE workflows;`
}

let getAndWritePage = async (octokit: Octokit, sql: postgres.Sql<any>, page: number) => {
  console.log(`getting page ${page}`);
  let result = await getWorkflowPage(octokit, 100, page);
  let workflows = result.data.workflow_runs.map((w: any) => ({ data : w }));
  await writeWorkflows(sql, workflows);
}

let fetchAndStoreWorkflows = async (octokit: Octokit, sql: postgres.Sql<any>) => {
  let page1 = await getWorkflowPage(octokit, 1);
  const total_entries = page1.data.total_count;
  console.log(`${total_entries} to fetch`);
  const entries_per_page = 100;

  const total_pages = Math.ceil(total_entries / entries_per_page);

  let range = [...Array(total_pages).keys()];

  for (const page_group of (windowify(range, 10))) {
    let promises = page_group.map(async index => {
      await getAndWritePage(octokit, sql, index + 1)
    });
    await Promise.all(promises);
  }
}

const octokit = await login();
const sql = await connect();

await createOrTruncateTable(sql);
await fetchAndStoreWorkflows(octokit, sql);

Deno.exit(0);
