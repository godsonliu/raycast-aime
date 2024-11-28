import {
  ActionPanel,
  List,
  Action,
  getPreferenceValues,
  PreferenceValues,
  useNavigation,
} from "@raycast/api";
import { useCallback, useState } from "react";
import https from "https";

interface Chat {
  question: string;
  answer: string;
  message_id: string;
}

interface Data {
  conversation_id?: string;
  message_id: string;
  answer: string;
}

type ParseData = (chunkArr: string[]) => Record<keyof Data, string>;

export default function Command() {
  const [query, setQuery] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [chats, setChats] = useState<Chat[]>([]);
  const [conversation_id, setConversation_id] = useState<string>("");
  const preference = getPreferenceValues<PreferenceValues>();
  const { push } = useNavigation();

  const parseData: ParseData = (chunkArr) => {
    let data = {
      conversation_id: "",
      message_id: "",
      answer: "",
    };
    const answers: string[] = [];
    chunkArr.forEach((item: string) => {
      try {
        data = JSON.parse(item);
        answers.push(data.answer);
      } catch (e) {
        // console.log(e);
      }
    });
    data.answer = answers.join("");
    return data;
  };

  const Chat = useCallback(() => {
    if (loading) return;
    setLoading(true);
    const req = https.request(
      {
        hostname: "ai.anker-in.com",
        path: "/base-api/v1/chat-messages",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${preference.token}`,
        },
      },
      (res) => {
        const answers: string[] = [];
        let answer = "";
        res.on("data", (chunk) => {
          const chunkArr = chunk
            .toString()
            .split("data: ")
            .map((item: string) => item.trim())
            .filter((item: string) => item);
          answers.push(...chunkArr);
          const data = parseData(chunkArr);
          if (data?.answer) {
            answer += data.answer;
            const message_id = data.message_id;
            setChats((prev) => {
              let chats: Chat[] = JSON.parse(JSON.stringify(prev));
              let flag = false;
              chats.forEach((item) => {
                if (item.message_id === message_id) {
                  flag = true;
                  item.answer = answer;
                }
              });
              if (!flag) {
                chats = [
                  { question: query, answer: answer, message_id },
                  ...prev,
                ];
              }
              return chats;
            });
          }
        });
        res.on("end", () => {
          const data = parseData(answers);
          if (data.answer) {
            setConversation_id(data.conversation_id);
            const message_id = data.message_id;
            setChats((prev) => {
              const chats: Chat[] = JSON.parse(JSON.stringify(prev));
              chats.forEach((item) => {
                if (item.message_id === message_id) {
                  item.answer = data.answer;
                }
              });
              return chats;
            });
          }
          setLoading(false);
        });
      }
    );
    req.write(
      JSON.stringify({
        response_mode: "streaming",
        conversation_id,
        query,
        inputs: {},
        user: "aime",
      })
    );
    req.end();
    setQuery("");
  }, [query, loading]);

  return (
    <List
      navigationTitle="AIME"
      searchBarPlaceholder="Ask AIME"
      isShowingDetail={!!chats.length}
      searchText={query}
      onSearchTextChange={setQuery}
      filtering={false}
      isLoading={loading}
      selectedItemId="0"
      actions={
        <ActionPanel>
          <ActionPanel.Section>
            <Action title="Ask Aime" onAction={Chat} />
          </ActionPanel.Section>
        </ActionPanel>
      }
    >
      {chats.length ? (
        <>
          {chats.map((chat, index) => (
            <List.Item
              id={index.toString()}
              key={chat.message_id}
              title={chat.question}
              detail={<List.Item.Detail markdown={chat.answer} />}
              actions={
                <ActionPanel>
                  {query ? (
                    <ActionPanel.Section>
                      <Action title="Ask Aime" onAction={Chat} />
                    </ActionPanel.Section>
                  ) : (
                    <Action.CopyToClipboard
                      title="Copy Answer"
                      content={chat.answer}
                    />
                  )}
                </ActionPanel>
              }
            />
          ))}
        </>
      ) : (
        <List.EmptyView title="No results" />
      )}
    </List>
  );
}
