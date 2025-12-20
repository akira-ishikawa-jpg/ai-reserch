import streamlit as st

st.title("AIサービス認知・提案計測システム（MVP）")
st.write("サービスURLや課題文を入力し、AIによる提案計測・探索を行います。")

# 入力フォーム（雛形）
service_url = st.text_input("サービスURL")
issue_text = st.text_area("課題文（1件）")
ai_tools = st.multiselect("使用するAIツール（最大4つ）", ["OpenAI GPT-4", "Anthropic Claude", "Google Gemini", "Microsoft Azure OpenAI"], default=["OpenAI GPT-4"])
competitors = st.text_input("競合サービス名（カンマ区切り、任意）")

# サービス理解機能
if st.button("サービス情報を取得") and service_url:
    with st.spinner("サービス情報を取得中..."):
        import requests
        try:
            resp = requests.post(
                "http://localhost:8000/service_info",
                json={"url": service_url},
                timeout=30
            )
            data = resp.json()
            if "error" in data:
                st.error(data["error"])
            else:
                st.success("サービス情報の取得に成功しました")
                st.write(f"**サービス名:** {data['name']}")
                st.write(f"**概要:** {data['summary']}")
                st.write(f"**想定課題カテゴリ:** {', '.join(data['categories'])}")
        except Exception as e:
            st.error(f"エラー: {e}")

st.divider()


tab1, tab2 = st.tabs(["課題起点での提案率測定", "Deep Research（課題探索）"])

with tab1:
    if st.button("計測・探索を実行"):
        if not issue_text or not service_url or not ai_tools:
            st.warning("課題文・サービスURL・AIツールを入力してください")
        else:
            # サービス名取得（簡易: URLから再取得）
            with st.spinner("サービス情報取得中..."):
                import requests
                info_resp = requests.post(
                    "http://localhost:8000/service_info",
                    json={"url": service_url},
                    timeout=30
                )
                info = info_resp.json()
                if "error" in info:
                    st.error("サービス情報の取得に失敗しました")
                else:
                    service_name = info["name"]
                    competitors_list = [c.strip() for c in competitors.split(",") if c.strip()]
                    with st.spinner("AI実行・集計中..."):
                        measure_resp = requests.post(
                            "http://localhost:8000/measure_proposal",
                            json={
                                "issue": issue_text,
                                "ai_tools": ai_tools,
                                "competitors": competitors_list,
                                "service_name": service_name
                            },
                            timeout=120
                        )
                        result = measure_resp.json()
                        st.subheader("AI実行結果サマリ")
                        st.write("### サービス出現回数 (AIツール別)")
                        st.write(result["summary"]["service_count"])
                        st.write("### 競合サービス出現回数 (AIツール別)")
                        st.write(result["summary"]["competitor_count"])
                        st.write("### 各AI回答・提案レベル")
                        for d in result["summary"]["details"]:
                            st.markdown(f"**[{d['tool']}]** 提案レベル: {d['service_level']}\n> {d['answer']}")

with tab2:
    if st.button("Deep Research（課題探索）を実行"):
        if not service_url or not ai_tools:
            st.warning("サービスURL・AIツールを入力してください")
        else:
            import requests
            competitors_list = [c.strip() for c in competitors.split(",") if c.strip()]
            with st.spinner("Deep Research実行中（時間がかかる場合があります）..."):
                resp = requests.post(
                    "http://localhost:8000/deep_research",
                    json={
                        "service_url": service_url,
                        "ai_tools": ai_tools,
                        "competitors": competitors_list
                    },
                    timeout=300
                )
                result = resp.json()
                if "error" in result:
                    st.error(result["error"])
                else:
                    st.subheader("Deep Research結果サマリ")
                    st.write("### 候補課題一覧")
                    st.write(result["candidate_issues"])
                    st.write("### 頻出課題・プロンプト上位3件")
                    for k, v in result["top3"]:
                        st.markdown(f"- {k} ... {v}件")
                    st.write("### サービス出現・競合出現集計")
                    st.write(result["summary"]["service_count"])
                    st.write(result["summary"]["competitor_count"])
