

## Fetch workflow data

1. Start Docker container
   ```
    docker run -e PG_PASSWORD=<password> -p 5432:5432 -ti timescale/timescaledb-ha:pg14-latest
   ```
2. set environment variables:
   ```
    export GH_API_TOKEN=<valid github API token>
    export PGUSER=postgres
    export PGPASSWORD=<password>
   ```
3. Initialize DB:
   ```
   docker run -ti <postgres_container> psql 'CREATE TABLE workflows(data JSONB NOT NULL);'
   ```
4. Run script:
   ```
   deno run --unstable --allow-env --allow-net=localhost:5432,api.github.com index.ts
   ```

## Run analysis on data

1. Monthly workflow retrigger percentage
   ```SQL
   WITH
    grouping_period AS (SELECT 'month'),
    all_data AS (SELECT data ->> 'id'                            as id,
                         data ->> 'conclusion'                    as conclusion,
                         data ->> 'run_number'                    as run_number,
                         data ->> 'run_attempt'                   as run_attempt,
                         (data ->> 'run_started_at')::timestamptz as run_started_at,
                         data -> 'triggering_actor' ->> 'type'    as triggering_actor_type,
                         data -> 'triggering_actor' ->> 'login'   as triggering_actor_login
                  FROM workflows),
    retrigger_data AS (SELECT *
                        FROM all_data
                        WHERE run_attempt <> '1'),
    weekly_retrigger_counts AS (
        SELECT date_trunc((SELECT * FROM grouping_period), run_started_at) as bucket
             , count(*) as retrigger_count
             , count(DISTINCT triggering_actor_login) as retrigger_actors
        FROM retrigger_data
        GROUP BY 1
        ORDER BY 1 DESC
    ),
    weekly_build_counts AS (
        SELECT date_trunc((SELECT * FROM grouping_period), run_started_at) as bucket
                        , count(*) as build_count
                        , count(DISTINCT triggering_actor_login) as actor_count
                   FROM all_data
                   GROUP BY 1
                   ORDER BY 1 DESC
   )
   SELECT
   bucket::date,
   build_count as total_builds,
   to_char(100 * COALESCE(retrigger_count, 0)::double precision / build_count, '999D99') as pct_retriggered,
   actor_count as total_actors,
   to_char(100 * COALESCE(retrigger_actors, 0)::double precision / actor_count, '999') as pct_actors_affected
   FROM weekly_build_counts LEFT JOIN weekly_retrigger_counts USING (bucket);
   ```
   
2. 