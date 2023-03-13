import { AskOptions, BaseClient } from "@xata.io/client";

type Database = {
  id: string;
  name: string;
  client: BaseClient;
  lookupTable: string;
  options: AskOptions<any>;
};

export const getDatabases = (): Database[] => {
  const netlifyDocs = new BaseClient({
    databaseURL: "https://netlify-docs-4qbksj.us-east-1.xata.sh/db/docs",
  });

  return [
    {
      id: "netlifyDocs",
      client: netlifyDocs,
      name: "Netlify docs",
      lookupTable: "docs",
      options: {
        rules: [
          "You are a friendly chat bot that answers questions about the Netlify platform.",
          'Only answer questions that are relating to the defined context or are general technical questions. If asked about a question outside of the context, you can respond with "It doesn\'t look like I have enough information to answer that. Check the documentation or contact support."',
        ],
        searchType: "keyword",
        search: {
          fuzziness: 1,
          prefix: "phrase",
        },
      },
    },
  ];
};
