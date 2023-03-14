import { fetchEventSource } from "@microsoft/fetch-event-source";
import { InferGetStaticPropsType } from "next";
import Head from "next/head";
import { useCallback, useState, useEffect } from "react";
import styles from "~/styles/Home.module.css";
import { getDatabases } from "~/xata";
import { z } from "zod";

export async function getStaticProps() {
  const dbs = [];

  for (const database of getDatabases()) {
    const { id, name, client: xata, lookupTable } = database;
    const { aggs } = await xata.db[lookupTable]?.aggregate({
      total: { count: "*" },
    });

    dbs.push({ id, name, recordCount: aggs.total });
  }

  return { props: { dbs } };
}

function prettyFormatNumber(num: number) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

const useAskXataDocs = () => {
  const [answer, setAnswer] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);
  const [records, setRecords] = useState<string[]>([]);

  const askQuestion = useCallback((database: string, question: string) => {
    if (!question) return;

    setAnswer(undefined);
    setIsLoading(true);

    void fetchEventSource(`/api/ask`, {
      method: "POST",
      body: JSON.stringify({ question, database }),
      headers: { "Content-Type": "application/json" },
      onmessage(ev) {
        try {
          const { answer = "", records, done } = JSON.parse(ev.data);
          if (records) {
            setRecords(records);
            throw new Error("stop");
          }
          setAnswer((prev = "") => `${prev}${answer}`);
          setIsLoading(!done);
        } catch (e) {}
      },
      onclose() {
        // do nothing to stop the operation
      },
      onerror(err) {
        throw err; // rethrow to stop the operation
      },
    });
  }, []);

  // Clear answer function
  const clearAnswer = useCallback(() => {
    setAnswer(undefined);
    setIsLoading(false);
    setRecords([]);
  }, []);

  return { isLoading, answer, records, askQuestion, clearAnswer };
};

const xataDocsResponse = z.array(
  z.object({ id: z.string(), title: z.string(), slug: z.string() })
);

export type XataDocsResponse = z.infer<typeof xataDocsResponse>;

export const useGetXataDocs = (database: string, ids: string[] = []) => {
  const [relatedDocs, setRelatedDocs] = useState<XataDocsResponse>([]);

  useEffect(() => {
    if (ids?.length === 0) {
      setRelatedDocs([]);
      return;
    }

    const fetchData = async () => {
      const response = await fetch(`/api/docs-get`, {
        method: "POST",
        body: JSON.stringify({ database, ids }),
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();
      setRelatedDocs(xataDocsResponse.parse(data));
    };
    fetchData();
  }, [database, ids]);

  const clearRelated = useCallback(() => {
    setRelatedDocs([]);
  }, []);

  return { relatedDocs, clearRelated };
};

export default function Home({
  dbs,
}: InferGetStaticPropsType<typeof getStaticProps>) {
  const [question, setQuestion] = useState<string>("");
  const [selected, setSelected] = useState<string>(dbs[0].id);

  const { answer, isLoading, records, askQuestion } = useAskXataDocs();
  const { relatedDocs, clearRelated } = useGetXataDocs(selected, records);

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    clearRelated();
    askQuestion(selected, question);
  };

  return (
    <>
      <Head>
        <title>Xata Chat Demo</title>
        <meta name="description" content="Xata Chat Demo" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <main className={styles.main}>
        <div className={styles.container}>
          <h1 className={styles.title}>Xata Ask Demo</h1>

          <div className={styles.grid}>
            {dbs.map(({ id, name, recordCount }) => (
              <div
                key={`database-${id}`}
                className={styles.card}
                onClick={() => setSelected(id)}
                style={{
                  color: selected === id ? "#0070f3" : "inherit",
                  borderColor: selected === id ? "#0070f3" : "inherit",
                }}
              >
                <h3 style={{ marginBottom: 10 }}>{name}</h3>
                <p>
                  {prettyFormatNumber(recordCount)}{" "}
                  {recordCount === 1 ? "record" : "records"}
                </p>
              </div>
            ))}
          </div>
          <form className={styles.inputGroup} onSubmit={handleFormSubmit}>
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className={styles.input}
              placeholder={"Write a question to ask the chatbot"}
            />
            <div className={styles.inputRightElement}>
              <button className={styles.button} type="submit">
                Ask
              </button>
            </div>
          </form>
          {answer ? (
            <p className={styles.response}>{answer}</p>
          ) : isLoading ? (
            <div style={{ display: "flex", justifyContent: "center" }}>
              <span className={styles.loader} />
            </div>
          ) : null}
          {relatedDocs.length > 0 && (
            <div className={styles.relatedDocs}>
              <p>I have used the following doc pages as context:</p>
              {relatedDocs.map(({ id, title, slug }) => (
                <li key={id}>
                  <a href={"https://" + slug} target="_blank">
                    {title}
                  </a>
                </li>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
