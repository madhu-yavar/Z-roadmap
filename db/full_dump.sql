--
-- PostgreSQL database dump
--

\restrict hDCsE5YBygYzzzrkoRtUY8hnpM7oFHqoEYMp5FhMNUEJbf3iFgeZasXfV5YiubT

-- Dumped from database version 14.19 (Homebrew)
-- Dumped by pg_dump version 14.19 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: feature_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.feature_status AS ENUM (
    'PLANNED',
    'IN_PROGRESS',
    'DELAYED',
    'DONE'
);


--
-- Name: project_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.project_status AS ENUM (
    'PLANNED',
    'IN_PROGRESS',
    'DELAYED',
    'DONE'
);


--
-- Name: project_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.project_type AS ENUM (
    'CLIENT',
    'INHOUSE',
    'RD',
    'PIPELINE'
);


--
-- Name: user_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_role AS ENUM (
    'CEO',
    'VP',
    'BA',
    'PM'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.documents (
    id integer NOT NULL,
    project_id integer,
    uploaded_by integer NOT NULL,
    file_name character varying(255) NOT NULL,
    file_type character varying(30) NOT NULL,
    file_path character varying(1000) NOT NULL,
    notes character varying(2000) NOT NULL,
    created_at timestamp without time zone NOT NULL,
    file_hash character varying(64) DEFAULT ''::character varying NOT NULL
);


--
-- Name: documents_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.documents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.documents_id_seq OWNED BY public.documents.id;


--
-- Name: features; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.features (
    id integer NOT NULL,
    project_id integer NOT NULL,
    name character varying(255) NOT NULL,
    status public.feature_status NOT NULL,
    progress_pct integer NOT NULL,
    notes character varying(2000) NOT NULL,
    created_at timestamp without time zone NOT NULL
);


--
-- Name: features_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.features_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: features_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.features_id_seq OWNED BY public.features.id;


--
-- Name: intake_analyses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.intake_analyses (
    id integer NOT NULL,
    intake_item_id integer NOT NULL,
    primary_type character varying(40) NOT NULL,
    confidence character varying(10) NOT NULL,
    output_json json NOT NULL,
    created_at timestamp without time zone NOT NULL,
    updated_at timestamp without time zone NOT NULL
);


--
-- Name: intake_analyses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.intake_analyses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: intake_analyses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.intake_analyses_id_seq OWNED BY public.intake_analyses.id;


--
-- Name: intake_item_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.intake_item_versions (
    id integer NOT NULL,
    intake_item_id integer NOT NULL,
    action character varying(40) NOT NULL,
    changed_by integer,
    changed_fields json NOT NULL,
    before_data json NOT NULL,
    after_data json NOT NULL,
    created_at timestamp without time zone NOT NULL
);


--
-- Name: intake_item_versions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.intake_item_versions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: intake_item_versions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.intake_item_versions_id_seq OWNED BY public.intake_item_versions.id;


--
-- Name: intake_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.intake_items (
    id integer NOT NULL,
    document_id integer NOT NULL,
    document_class character varying(40) NOT NULL,
    title character varying(255) NOT NULL,
    scope character varying(4000) NOT NULL,
    activities json NOT NULL,
    source_quotes json NOT NULL,
    status character varying(30) NOT NULL,
    reviewed_by integer,
    roadmap_item_id integer,
    created_at timestamp without time zone NOT NULL,
    updated_at timestamp without time zone NOT NULL,
    priority character varying(20) DEFAULT 'medium'::character varying NOT NULL,
    project_context character varying(30) DEFAULT 'client'::character varying NOT NULL,
    initiative_type character varying(30) DEFAULT 'new_feature'::character varying NOT NULL,
    delivery_mode character varying(20) DEFAULT 'standard'::character varying NOT NULL,
    rnd_hypothesis character varying(2000) DEFAULT ''::character varying NOT NULL,
    rnd_experiment_goal character varying(2000) DEFAULT ''::character varying NOT NULL,
    rnd_success_criteria character varying(2000) DEFAULT ''::character varying NOT NULL,
    rnd_timebox_weeks integer,
    rnd_decision_date character varying(40) DEFAULT ''::character varying NOT NULL,
    rnd_next_gate character varying(30) DEFAULT ''::character varying NOT NULL,
    rnd_risk_level character varying(20) DEFAULT ''::character varying NOT NULL
);


--
-- Name: intake_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.intake_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: intake_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.intake_items_id_seq OWNED BY public.intake_items.id;


--
-- Name: llm_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.llm_configs (
    id integer NOT NULL,
    provider character varying(40) NOT NULL,
    model character varying(120) NOT NULL,
    base_url character varying(300) NOT NULL,
    api_key character varying(300) NOT NULL,
    is_active boolean NOT NULL,
    created_at timestamp without time zone NOT NULL
);


--
-- Name: llm_configs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.llm_configs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: llm_configs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.llm_configs_id_seq OWNED BY public.llm_configs.id;


--
-- Name: projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projects (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    description character varying(2000) NOT NULL,
    project_type public.project_type NOT NULL,
    status public.project_status NOT NULL,
    progress_pct integer NOT NULL,
    target_date date,
    owner_id integer NOT NULL,
    created_at timestamp without time zone NOT NULL
);


--
-- Name: projects_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.projects_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: projects_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.projects_id_seq OWNED BY public.projects.id;


--
-- Name: roadmap_item_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roadmap_item_versions (
    id integer NOT NULL,
    roadmap_item_id integer NOT NULL,
    action character varying(40) NOT NULL,
    changed_by integer,
    changed_fields json NOT NULL,
    before_data json NOT NULL,
    after_data json NOT NULL,
    created_at timestamp without time zone NOT NULL
);


--
-- Name: roadmap_item_versions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.roadmap_item_versions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: roadmap_item_versions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.roadmap_item_versions_id_seq OWNED BY public.roadmap_item_versions.id;


--
-- Name: roadmap_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roadmap_items (
    id integer NOT NULL,
    title character varying(255) NOT NULL,
    scope character varying(4000) NOT NULL,
    activities json NOT NULL,
    source_document_id integer,
    created_from_intake_id integer,
    created_at timestamp without time zone NOT NULL,
    priority character varying(20) DEFAULT 'medium'::character varying NOT NULL,
    project_context character varying(30) DEFAULT 'client'::character varying NOT NULL,
    initiative_type character varying(30) DEFAULT 'new_feature'::character varying NOT NULL,
    accountable_person character varying(255) DEFAULT ''::character varying NOT NULL,
    picked_up boolean DEFAULT false NOT NULL,
    delivery_mode character varying(20) DEFAULT 'standard'::character varying NOT NULL,
    rnd_hypothesis character varying(2000) DEFAULT ''::character varying NOT NULL,
    rnd_experiment_goal character varying(2000) DEFAULT ''::character varying NOT NULL,
    rnd_success_criteria character varying(2000) DEFAULT ''::character varying NOT NULL,
    rnd_timebox_weeks integer,
    rnd_decision_date character varying(40) DEFAULT ''::character varying NOT NULL,
    rnd_next_gate character varying(30) DEFAULT ''::character varying NOT NULL,
    rnd_risk_level character varying(20) DEFAULT ''::character varying NOT NULL
);


--
-- Name: roadmap_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.roadmap_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: roadmap_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.roadmap_items_id_seq OWNED BY public.roadmap_items.id;


--
-- Name: roadmap_plan_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roadmap_plan_items (
    id integer NOT NULL,
    bucket_item_id integer NOT NULL,
    title character varying(255) NOT NULL,
    scope character varying(4000) NOT NULL,
    activities json NOT NULL,
    priority character varying(20) NOT NULL,
    project_context character varying(30) NOT NULL,
    initiative_type character varying(30) NOT NULL,
    entered_roadmap_at timestamp without time zone NOT NULL,
    tentative_duration_weeks integer,
    pickup_period character varying(40) NOT NULL,
    completion_period character varying(40) NOT NULL,
    created_at timestamp without time zone NOT NULL,
    accountable_person character varying(255) DEFAULT ''::character varying NOT NULL,
    delivery_mode character varying(20) DEFAULT 'standard'::character varying NOT NULL,
    rnd_hypothesis character varying(2000) DEFAULT ''::character varying NOT NULL,
    rnd_experiment_goal character varying(2000) DEFAULT ''::character varying NOT NULL,
    rnd_success_criteria character varying(2000) DEFAULT ''::character varying NOT NULL,
    rnd_timebox_weeks integer,
    rnd_decision_date character varying(40) DEFAULT ''::character varying NOT NULL,
    rnd_next_gate character varying(30) DEFAULT ''::character varying NOT NULL,
    rnd_risk_level character varying(20) DEFAULT ''::character varying NOT NULL,
    planned_start_date character varying(20) DEFAULT ''::character varying NOT NULL,
    planned_end_date character varying(20) DEFAULT ''::character varying NOT NULL,
    resource_count integer,
    effort_person_weeks integer,
    planning_status character varying(20) DEFAULT 'not_started'::character varying NOT NULL,
    confidence character varying(20) DEFAULT 'medium'::character varying NOT NULL,
    dependency_ids json DEFAULT '[]'::json NOT NULL
);


--
-- Name: roadmap_plan_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.roadmap_plan_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: roadmap_plan_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.roadmap_plan_items_id_seq OWNED BY public.roadmap_plan_items.id;


--
-- Name: roadmap_redundancy_decisions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roadmap_redundancy_decisions (
    id integer NOT NULL,
    left_item_id integer NOT NULL,
    right_item_id integer NOT NULL,
    decision character varying(32) NOT NULL,
    decided_by integer,
    created_at timestamp without time zone NOT NULL,
    updated_at timestamp without time zone NOT NULL
);


--
-- Name: roadmap_redundancy_decisions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.roadmap_redundancy_decisions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: roadmap_redundancy_decisions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.roadmap_redundancy_decisions_id_seq OWNED BY public.roadmap_redundancy_decisions.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    full_name character varying(120) NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    role public.user_role NOT NULL,
    created_at timestamp without time zone NOT NULL
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: documents id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents ALTER COLUMN id SET DEFAULT nextval('public.documents_id_seq'::regclass);


--
-- Name: features id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.features ALTER COLUMN id SET DEFAULT nextval('public.features_id_seq'::regclass);


--
-- Name: intake_analyses id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intake_analyses ALTER COLUMN id SET DEFAULT nextval('public.intake_analyses_id_seq'::regclass);


--
-- Name: intake_item_versions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intake_item_versions ALTER COLUMN id SET DEFAULT nextval('public.intake_item_versions_id_seq'::regclass);


--
-- Name: intake_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intake_items ALTER COLUMN id SET DEFAULT nextval('public.intake_items_id_seq'::regclass);


--
-- Name: llm_configs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.llm_configs ALTER COLUMN id SET DEFAULT nextval('public.llm_configs_id_seq'::regclass);


--
-- Name: projects id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects ALTER COLUMN id SET DEFAULT nextval('public.projects_id_seq'::regclass);


--
-- Name: roadmap_item_versions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roadmap_item_versions ALTER COLUMN id SET DEFAULT nextval('public.roadmap_item_versions_id_seq'::regclass);


--
-- Name: roadmap_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roadmap_items ALTER COLUMN id SET DEFAULT nextval('public.roadmap_items_id_seq'::regclass);


--
-- Name: roadmap_plan_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roadmap_plan_items ALTER COLUMN id SET DEFAULT nextval('public.roadmap_plan_items_id_seq'::regclass);


--
-- Name: roadmap_redundancy_decisions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roadmap_redundancy_decisions ALTER COLUMN id SET DEFAULT nextval('public.roadmap_redundancy_decisions_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: documents; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.documents (id, project_id, uploaded_by, file_name, file_type, file_path, notes, created_at, file_hash) FROM stdin;
27	\N	1	SmartDoc.pdf	pdf	storage/uploads/7f9d3467d4fe40f69cc7dd7bda20ed58.pdf		2026-02-08 13:56:33.965355	7fa32e9962f22430198c83e4e53a81585b9bd18b8a5af607e4399fc72d08008e
28	\N	1	Vendor Onboarding Agent.pdf	pdf	storage/uploads/324b826b31094c19894b68ec917fe239.pdf		2026-02-08 13:57:50.994525	c6ba0d04c8f2eb5a59ebe761774353850c66a4e57ddc7d538f26325c45b36a4b
29	\N	1	Request for Proposal.pdf	pdf	storage/uploads/e1c043c7d64e44ca98078433c28cf263.pdf		2026-02-09 04:54:27.548656	56cc60d63ea0f361beb4bce8003b854ef3c2181496b2d18f5e9806eb6acd6dd0
30	\N	1	Journey- 104 helpline BRD.pdf	pdf	storage/uploads/0cd3dfc3eb0b4227bc3069ba399f5f76.pdf		2026-02-09 05:00:51.602627	35cef2a70fa95154b1dbbdb1e1cf63b20f701f066c36676b32236fba6ce1aedb
31	\N	1	Z.docx	docx	storage/uploads/43ff2c444de8491aad0313e999be3049.docx		2026-02-09 05:45:01.676513	8e9a2f4db24f64d15ee4f84d81d7905a6bee7419f0e347c6a101c694d530a9ed
32	\N	1	Screenshot 2026-02-09 at 2.02.12 PM.png	png	storage/uploads/799a4b56da5b4740880fc6e704a4609a.png		2026-02-09 08:40:25.60065	b5960739959ef2629e777a7cbfdd8ff8b9cf6ee76adfa77a0c7a51d140825c30
33	\N	1	AI Concierge Platform - wireframe.docx	docx	storage/uploads/48041cbd5a724d6dba255a6e5ce90331.docx		2026-02-09 11:30:56.230933	95bba23540b5200ec1e9d264ec2eecfe055b1d7663444ec623e62b487c728290
34	\N	1	AI - Human BRD.docx	docx	storage/uploads/ef3f23dd47fd44dfb7eb03f05cb94c54.docx		2026-02-09 11:30:56.256617	bfd2ff4e92ff2dcb409f98d3cf929c74281e6c391d44b921a78d81cded4b7307
35	\N	1	SmartDoc - compressed.pdf	pdf	storage/uploads/5ab9268c76cb4597bfef6f931b1bb9ce.pdf		2026-02-09 11:30:56.278304	aba5ced65e2aa08476a156e88bc7c92f00f24ec5fde1e5116b67e17559940ace
36	\N	1	Expense Management Solution Proposal.docx	docx	storage/uploads/9fb3c296b720474a87bfdc987b92c32e.docx		2026-02-09 11:30:56.298968	a8916f81cd496203a477701d6c57a525a32f1c60f412604a8fc1466c39c952e7
37	\N	1	Z-Transact Document- Final.docx	docx	storage/uploads/e9137c3be590426589504d76f6df156d.docx		2026-02-09 11:30:56.314852	6e38a1427fd5c9c27aa645fe144367253e23d8d1f35289ada8c503db406b0114
38	\N	1	Dimexon Solution Document ver 1.2_U.pdf	pdf	storage/uploads/3ea7f5724cce49d982882bb783303ca1.pdf		2026-02-09 11:30:56.327543	d2aa46d9c59f760cbf9bf16420ed7eddc049c242c994b77fe2a0ccc6588bf743
39	\N	1	Expense Management.docx	docx	storage/uploads/4bef8302af9c43ee8f5d962d1fa05669.docx		2026-02-09 11:30:56.369195	8fa8cdd8b4ef93e75c1320b1810d74f721944983b12352d45d527a05009e261d
40	\N	1	Employee Record Assistant 2.docx	docx	storage/uploads/8c48682aaa2d49e0b8b9870c67ba4bcb.docx		2026-02-09 11:30:56.383479	f523c3266ba8c5a7ba46b5d4adee1604c22f4d85727b22a25b977a80bc3785c8
41	\N	1	104 HealthCare Helpline BRD.docx	docx	storage/uploads/0e798dfa750a4f439740f8f1d6b1b77e.docx		2026-02-09 11:30:56.393171	a8c12da5c07922941eef6cbd5a30adb23943daea932a48855ebec6c2ebf4bd25
42	\N	1	BRD_Platform_Z-Agent.V1.docx	docx	storage/uploads/7f5de422e51949118ac9419ef88cf26a.docx		2026-02-09 11:30:56.405465	893b9b58baeb30b37c615dd246b4bc53b5126afb7ef4a6d92ed2bf27e34b78a1
43	\N	1	Cx Agent 1.docx	docx	storage/uploads/d17a8954005048b588f675b887209d38.docx		2026-02-09 11:30:56.442481	f8e4ceaa18e85299f7a821670eb21cdf58528b362df0d89c3275d9aac19d25a5
44	\N	1	Ex Agent 2.docx	docx	storage/uploads/f0ce18a77b9b49f688e3a5febbb0c438.docx		2026-02-09 11:30:56.452416	5de6c8aed4dd857d2dce3e1e14a275396e81fd0ea8b0b8ed8120cdc635f184d8
45	\N	1	Employee Onboarding Agent 2.docx	docx	storage/uploads/ca3a7f5c146540dfa1e062586063d15e.docx		2026-02-09 11:30:56.467776	bfabcfd4d7dc9b47922332e03407deeba157dfaaddfd72a27e8292746bcc211f
46	\N	1	BRD_Z-Agent platform_ver.1.xlsx	xlsx	storage/uploads/92e4d3f20d844f2481f9a11d75385086.xlsx		2026-02-09 11:30:56.478699	a568f5a78744bd1fe588781a4e4b3b905242927ca25f6d97e662150d1f43dcb1
47	\N	1	Dimexon Solution Document ver1.1.pdf	pdf	storage/uploads/efaa13d0a9d54f5793ed5f8ff54f4623.pdf		2026-02-09 11:30:56.490325	7afe4e76906e16c36bc323bc4720eb1f7a6a2b51b25b35b5cc533799156dd15f
48	\N	1	Hotel_KPI_Master.xlsx	xlsx	storage/uploads/472f7b36c78e4eaaafd55915b3c4788e.xlsx		2026-02-09 11:30:56.49697	9e214893d7021653f19cebd9dbe5e021f6fd6032add3023e31f92a706e7bc627
49	\N	1	BRD_Platform_Z-Agent.docx	docx	storage/uploads/edf2f6124c054572a63c54231265016b.docx		2026-02-09 11:30:56.507631	ca289a292f7505c009412e20a958f2a99fb2a61ae55a41b36c2d9cf2c6bd3eeb
50	\N	1	BRD_Employee Experience Agent.docx	docx	storage/uploads/9aa5dbd958074dcf98db263ba6088d25.docx		2026-02-09 11:30:56.51677	6db060512bec9a3744b222b8630ed46d5339d3659893fe7fee7e7ebf88fc4c1e
51	\N	1	Z-Carbon Market Research.xlsx	xlsx	storage/uploads/1f78b522114e47359045a9efc60b140b.xlsx		2026-02-09 11:30:56.525994	0368899ba6355299ffba79cf86973bc888ed6fc79511e3c5c840bc2e9224b1d9
52	\N	1	XOOG_Product Handbook 2.docx	docx	storage/uploads/bc3f6ca70272490bbfd357dce3de1f50.docx		2026-02-09 11:30:56.537698	80f8994b809a01f6253beac44b9f1f08e0163147cfe2508c641119e2e5740af2
53	\N	1	Z-Transact_ArcheGlobal-Solution_P1.pdf	pdf	storage/uploads/26f15af9737d415b90875836a7477deb.pdf		2026-02-09 11:30:56.631796	5e54f1d3c7d2497cdb9e8f35a62cfe9132a3e05ec8501c849c4da79f3354c2a2
54	\N	1	Z-Agent Competitors Research.xlsx	xlsx	storage/uploads/b5ec3b91595241308e0c1f1b8ecc6cb0.xlsx		2026-02-09 11:30:56.643027	a622e52e2ca920a512764274a49edd066782a17e85078bf63ae8234edc5fc840
55	\N	1	HR Intelligence Brochure.pdf	pdf	storage/uploads/4648fb9977194d3da5955032101bb8e7.pdf		2026-02-09 11:30:56.697585	c0c5a4a8dc78f4d6dff48d2a1b328e57a31b302aabbba18421188cffce9f3de8
56	\N	1	Z-Carbon PPT.pptx	pptx	storage/uploads/15f9cd04cee94f35847e04f39f0de2d7.pptx		2026-02-09 11:30:56.739038	5c403bec294021ce9f725f81520a371396a3f36484e8ad420d0f3508f504ab49
57	\N	1	Z-ExpenseBRD (1).docx	docx	storage/uploads/f4ccd40afd2f4b5baae88394d792a2f3.docx		2026-02-09 11:30:56.74675	a902ff07445d251e44dc8a814b889c56068848074b7d9b76f2646581e95bb64c
58	\N	1	Z-Transact-Expense-Management- PPT.pptx	pptx	storage/uploads/b528c1ee2885432797aca3ba1c5487ee.pptx		2026-02-09 11:30:56.81336	47c5c07624fe601361812c5458eeb60fff23a1d74d27602f45d1dc095ec9557f
59	\N	1	Dimexon Solution Document ver1.0.pdf	pdf	storage/uploads/9744bff99e5d494496e19db9588d2a89.pdf		2026-02-09 11:30:56.843532	bb99432ad08d5e1c7a41e7bdcf1b45496ce8cfd6dce66146dde85ccba1bcc32c
60	\N	1	XOOG_ The Solution - Client.pptx	pptx	storage/uploads/6a930aa610ad4777a0e75ff423fba1b1.pptx		2026-02-09 11:30:56.865748	7fecc9299d36e3f2a9ffddb811893b3536967de77e560d2b1b663e1856cd8933
61	\N	1	Z_Transact_Workflow- Arche.xlsx	xlsx	storage/uploads/252804b4f2db4dd2b851a2705ca0a124.xlsx		2026-02-09 11:30:56.874574	58361821481a2676d55df0a97d3acd7c4b7d72bce9a5357d16ee5652aced1add
62	\N	1	LGB_Furnace Intelligence System V.0.pdf	pdf	storage/uploads/1adcd1fd26a1417f9344165ab7ceb609.pdf		2026-02-09 11:30:56.886875	33a7ea24958a17cc603ff4f8e2cb4b0326185e63333c89bad942bfd34edd1490
63	\N	1	Z-Agent.xlsx	xlsx	storage/uploads/c0e15ef3aae14426a5cec6282aae92fd.xlsx		2026-02-09 11:30:56.900618	5b582c61597edbd88ed50b624d19e896b66cc668f973419a854e2e6ffc77ea85
64	\N	1	Accounts Payable End.docx	docx	storage/uploads/601ce3bca6e147b180f329055e0030cc.docx		2026-02-09 11:30:56.90716	c9f92fe8ac186944df42b16e0262bea311ef49bd72e9838b74d77ed8b1d47853
69	\N	1	MR_Reconciliation_Txn_Agent_V1.0.xlsx	xlsx	storage/uploads/890d34cc48f54061be5357e2b827d333.xlsx		2026-02-09 11:30:56.961271	46e1ca3b885dbc0a8150198bcac0cf31d257905436e2a1893b36f061ca0a474b
65	\N	1	TravelSolution-ProcessFlow.pptx	pptx	storage/uploads/a8b428f663554273ad5854cc7b02fc4f.pptx		2026-02-09 11:30:56.926351	630302bdc12b15e4151f320b22cf61dfd0b287b86cd2c0a7c10c3f1cb03b7c99
66	\N	1	Expense Mgmt-workflow.xlsx	xlsx	storage/uploads/0f7e76a18a49404985b01ab2c739a13d.xlsx		2026-02-09 11:30:56.940014	338ab640a8bf10117d8fc8bdbce72458c47e585c821032f31ec7888699fc7b25
71	\N	1	Z-Scout Features List.docx	docx	storage/uploads/5f55f8b74bc24c189e2eb979e6eb4072.docx		2026-02-09 11:30:56.993232	6c6f7d700ad5f240dd8c320804f4816d93e966d276ad8288e6c0697115eb10a0
67	\N	1	HINCOL Requirements Capture.xlsx	xlsx	storage/uploads/06a25087f81b406496363251069521a3.xlsx		2026-02-09 11:30:56.944959	be8de6f01d89da3d02134b5a50049996adc36ea521e1311d12ea5bc1bb4d648a
72	\N	1	Reconciliation types.docx	docx	storage/uploads/5a865c701fbd4a90bade67bee5474b5a.docx		2026-02-09 11:30:56.999184	c2411bef685da3113c31247613747df6366c50b4af377364ed5446f20f03db99
68	\N	1	Business Req- HINCOL.docx	docx	storage/uploads/54df6cfa89d64c1d98e73039baff1626.docx		2026-02-09 11:30:56.952946	b5e69784571400c40712c7ae45f16b9f053dd8aef2592a2b4bebecae9da8de20
73	\N	1	ZTRANSACT_Req.docx	docx	storage/uploads/34fd016cfb3d4cc59c6316a55f477e7d.docx		2026-02-09 11:30:57.004846	9603ad8fa6015a24b878a2ea6f7862e7c55d31bbda991e7e35a38e80d9cd4c54
\.


--
-- Data for Name: features; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.features (id, project_id, name, status, progress_pct, notes, created_at) FROM stdin;
\.


--
-- Data for Name: intake_analyses; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.intake_analyses (id, intake_item_id, primary_type, confidence, output_json, created_at, updated_at) FROM stdin;
17	26	BRD	High	{"document_understanding_check": {"Primary intent (1 sentence)": "Request for Proposal (RFP) & Scope of Work (SOW) FOR STATUTORY AUDIT AND FINANCIAL ADVISORY SERVICES Association: Prestige Bella Vista Flat Owners Welfare Association (PBVFOWA) Period: For the Financial Year 2025-2026 IM", "Explicit outcomes (bullet list)": ["The appointed Auditor shall be responsible for performing the statutory audit and", "Goods & Services Tax (GST) Filings & Representation: o Ensuring the timely", "Signed Independent Auditor's Report on the Financial Statements. Filing of the Annual", "Crucial Deliverable: Qualification/Reporting of Bylaw Violations \\u2014 explicitly report any instances of", "Final Audit Timeline: Annual audit and final signed report must be completed"], "Dominant capability/theme (1 phrase)": "Request for Proposal", "Evidence": ["page:1:line:1", "page:2:line:1", "page:3:line:1"], "Confidence": "High"}, "llm_runtime": {"provider": "vertex_gemini", "model": "gemini-2.5-flash", "attempted": true, "success": true, "error": ""}, "parser_coverage": {"units_processed": 15, "refs_sample": ["page:1:line:1", "page:2:line:1", "page:3:line:1", "page:3:line:2", "page:3:line:3", "page:4:line:1", "page:4:line:2", "page:4:line:3", "page:4:line:4", "page:4:line:5", "page:4:line:6", "page:4:line:7"], "pages_detected": [1, 2, 3, 4, 5]}, "roadmap_candidate": {"Title": "Financial Services Provider Engagement", "Intent": "To secure independent and qualified firms for statutory audit and comprehensive financial advisory services for the upcoming financial year.", "Scope": "This covers the independent statutory audit and year-round tax and financial advisory for PBVFOWA for the Financial Year 2025-2026, with potential for split engagements.", "Activities": ["Define conduct statutory audit and financial reporting", "Define manage tax compliance and representation", "Define provide strategic financial advisory", "Define deliver independent audit reports and tax filings", "Define report bylaw non-compliance and recommend rectification"], "Evidence": ["page:1:line:1", "page:2:line:1", "page:3:line:1"], "Confidence": "High"}}	2026-02-09 04:55:16.61173	2026-02-09 04:55:51.910516
15	24	BRD	High	{"document_understanding_check": {"Primary intent (1 sentence)": "Enable automated document understanding and confidence-based workflow decisions.", "Explicit outcomes (bullet list)": ["What kind of document this is", "What data matters inside it", "How confident it is about that data", "What should happen next \\u2014 automatically"], "Dominant capability/theme (1 phrase)": "SmartDoc Roadmap Capability", "Evidence": ["page:1:line:1", "page:1:line:2", "page:1:line:3"], "Confidence": "High"}, "llm_runtime": {"provider": "vertex_gemini", "model": "gemini-2.5-flash", "attempted": true, "success": true, "error": ""}, "parser_coverage": {"units_processed": 134, "refs_sample": ["page:1:line:1", "page:1:line:2", "page:1:line:3", "page:1:line:4", "page:1:line:5", "page:1:line:6", "page:1:line:7", "page:1:line:8", "page:1:line:9", "page:1:line:10", "page:1:line:11", "page:1:line:12"], "pages_detected": [1, 2, 3, 4, 5, 6]}, "roadmap_candidate": {"Title": "SmartDoc Document Intelligence Platform", "Intent": "Enable automated document understanding and confidence-based workflow decisions to transform unstructured documents into actionable outcomes.", "Scope": "Process unstructured documents from ingestion through intelligent extraction, confidence-based routing, and enterprise system integration.", "Activities": ["Define ingest documents from diverse sources.", "Define classify document types and intent.", "Define extract data with confidence scores.", "Define route outcomes based on confidence thresholds.", "Define integrate with core enterprise systems."], "Evidence": ["page:1:line:1", "page:1:line:16", "page:1:line:17", "page:1:line:18", "page:1:line:19", "page:2:line:3"], "Confidence": "High"}}	2026-02-08 13:57:03.198125	2026-02-08 13:57:16.098062
16	25	BRD	High	{"document_understanding_check": {"Primary intent (1 sentence)": "Enable automated document understanding and confidence-based workflow decisions.", "Explicit outcomes (bullet list)": ["Step 1: Identity First. Always.", "Email verification via OTP", "Phone number verification via OTP", "Aadhaar-based OTP verification (India), with privacy-by-design controls"], "Dominant capability/theme (1 phrase)": "Vendor Onboarding Agent", "Evidence": ["page:1:line:1", "page:1:line:2", "page:1:line:3"], "Confidence": "High"}, "llm_runtime": {"provider": "vertex_gemini", "model": "gemini-2.5-flash", "attempted": true, "success": true, "error": ""}, "parser_coverage": {"units_processed": 117, "refs_sample": ["page:1:line:1", "page:1:line:2", "page:1:line:3", "page:1:line:4", "page:1:line:5", "page:1:line:6", "page:1:line:7", "page:1:line:8", "page:1:line:9", "page:1:line:10", "page:1:line:11", "page:1:line:12"], "pages_detected": [1, 2, 3, 4, 5]}, "roadmap_candidate": {"Title": "Automated Vendor Onboarding Platform", "Intent": "Enable leadership to approve documented business commitments and capability outcomes.", "Scope": "\\u2022 Country-specific tax and regulatory requirements GST, VAT, PAN, EIN, UEN, TRN\\u2014vendors are guided through only what applies to them, no more, no less.", "Activities": ["Implement secure vendor identity verification.", "Define automate compliance checks and requirements.", "Define extract and validate document data via AI.", "Define integrate risk, AML, and sanctions screening.", "Define orchestrate approval workflows and system activation."], "Evidence": ["page:1:line:1", "page:1:line:13", "page:1:line:16", "page:1:line:21", "page:2:line:1", "page:2:line:2"], "Confidence": "High"}}	2026-02-08 13:58:08.103178	2026-02-08 13:58:45.046121
18	27	BRD	High	{"document_understanding_check": {"Primary intent (1 sentence)": "104 Health Helpline- Detailed Doc (Click here).", "Explicit outcomes (bullet list)": ["Clarify business objective", "Confirm explicit expected outcomes"], "Dominant capability/theme (1 phrase)": "Journey- 104 helpline", "Evidence": ["page:1:line:1", "page:1:line:2", "page:2:line:1"], "Confidence": "High"}, "llm_runtime": {"provider": "vertex_gemini", "model": "gemini-2.5-flash", "attempted": true, "success": true, "error": ""}, "parser_coverage": {"units_processed": 5, "refs_sample": ["page:1:line:1", "page:1:line:2", "page:2:line:1", "page:3:line:1", "page:4:line:1"], "pages_detected": [1, 2, 3, 4]}, "roadmap_candidate": {"Title": "104 Health Helpline System", "Intent": "Deliver structured and comprehensive health assistance to citizens through an automated and human-supported helpline system.", "Scope": "Manage citizen interactions from initial contact through resolution, backend automation, and follow-up monitoring.", "Activities": ["Define process call intake and contextualization", "Define automate query resolution and triage", "Enable human and expert consultation", "Define automate backend workflows and closure", "Define monitor performance and ensure follow-up"], "Evidence": ["page:1:line:1", "page:1:line:2", "page:2:line:1"], "Confidence": "High"}}	2026-02-09 05:07:17.234708	2026-02-09 05:10:35.407194
19	28	BRD	Low	{"document_understanding_check": {"Primary intent (1 sentence)": "Document intent is unclear.", "Explicit outcomes (bullet list)": ["Clarify business objective", "Confirm explicit expected outcomes"], "Dominant capability/theme (1 phrase)": "Z Roadmap Capability", "Evidence": ["paragraph:2", "paragraph:3", "paragraph:4"], "Confidence": "Low"}, "llm_runtime": {"provider": "vertex_gemini", "model": "gemini-2.5-flash", "attempted": true, "success": true, "error": ""}, "parser_coverage": {"units_processed": 25, "refs_sample": ["paragraph:2", "paragraph:3", "paragraph:4", "paragraph:5", "paragraph:9", "paragraph:10", "paragraph:11", "paragraph:12", "paragraph:14", "paragraph:15", "paragraph:16", "paragraph:17"], "pages_detected": []}}	2026-02-09 05:45:28.591268	2026-02-09 05:45:28.591277
21	30	BRD	High	{"document_understanding_check": {"Primary intent (1 sentence)": "PHASE 1: DOCUMENT INGESTION \\u2013 BUSINESS REQUIREMENTS (For Technical Team) 1.", "Explicit outcomes (bullet list)": ["PHASE 1: DOCUMENT INGESTION \\u2013 BUSINESS REQUIREMENTS (For Technical Team)", "OBJECTIVE", "INPUT SOURCES", "DOCUMENT TYPES TO HANDLE", "AI CLASSIFICATION: WHAT TO DETECT IN EACH DOCUMENT?"], "Dominant capability/theme (1 phrase)": "ZTRANSACT Req Roadmap", "Evidence": ["paragraph:14", "paragraph:71"], "Confidence": "High"}, "llm_runtime": {"provider": "vertex_gemini", "model": "gemini-2.5-flash", "attempted": true, "success": true, "error": ""}, "parser_coverage": {"units_processed": 147, "refs_sample": ["paragraph:1", "paragraph:3", "paragraph:4", "paragraph:6", "paragraph:7", "paragraph:8", "paragraph:9", "paragraph:10", "paragraph:11", "paragraph:12", "paragraph:14", "paragraph:15"], "pages_detected": []}, "analysis_run": {"run_at": "2026-02-09T12:01:28.614767", "run_id": "4a91c25ca912", "forced": true}, "roadmap_candidate": {"Title": "Financial Document Processing Automation", "Intent": "Enable Z-TRANSACT to accurately process and verify diverse financial documents from multiple input channels.", "Scope": "This covers ingesting, classifying, extracting, and verifying various financial documents from defined input sources for Z-TRANSACT.", "Activities": ["Define ingest documents from specified sources", "Define auto-classify diverse financial document types", "Define extract required data fields from documents", "Define apply document-specific verification criteria", "Define process documents regardless of layout"], "Evidence": ["paragraph:1", "paragraph:4", "paragraph:6", "paragraph:12", "paragraph:14", "paragraph:70"], "Confidence": "High"}}	2026-02-09 12:01:28.640027	2026-02-09 12:01:51.295665
22	31	BRD	High	{"document_understanding_check": {"Primary intent (1 sentence)": "\\ud83d\\udccc Objective: To ensure the cash balance in the accounting system matches the balance in the bank statement.", "Explicit outcomes (bullet list)": ["Retrieve cash transactions from the general ledger.", "Pull transactions from expense reports or purchase journal.", "Match Transactions", "Validate with Receipts/Policies", "Suspicious transactions"], "Dominant capability/theme (1 phrase)": "Reconciliation types Roadmap", "Evidence": ["paragraph:29", "paragraph:55"], "Confidence": "High"}, "llm_runtime": {"provider": "vertex_gemini", "model": "gemini-2.5-flash", "attempted": true, "success": true, "error": ""}, "parser_coverage": {"units_processed": 175, "refs_sample": ["paragraph:1", "paragraph:3", "paragraph:4", "paragraph:5", "paragraph:6", "paragraph:7", "paragraph:8", "paragraph:9", "paragraph:10", "paragraph:11", "paragraph:12", "paragraph:13"], "pages_detected": []}, "analysis_run": {"run_at": "2026-02-09T12:04:51.568708", "run_id": "e2ef04cba278", "forced": true}, "roadmap_candidate": {"Title": "Comprehensive Reconciliation Framework", "Intent": "Establish a robust system to ensure accuracy and integrity of financial transactions across all accounts.", "Scope": "Encompasses bank, credit card, AP, AR, intercompany, payroll, expense, cash, inventory, and tax reconciliations.", "Activities": ["Standardize data ingestion processes", "Define automate transaction matching logic", "Identify and categorize all discrepancies", "Define streamline discrepancy resolution workflows", "Define generate compliance and audit trails"], "Evidence": ["paragraph:29"], "Confidence": "High"}}	2026-02-09 12:04:51.578619	2026-02-09 12:05:16.513385
24	33	Mixed / Composite Document	High	{"document_understanding_check": {"Primary intent (1 sentence)": "Enable automated document understanding and confidence-based workflow decisions.", "Explicit outcomes (bullet list)": ["| Petty Cash Reconciliation | Match cash in hand vs books |", "| Accounts Receivable & Customer Reconciliations | Customer Ledger Reconciliation | Match", "| TDS Reconciliation | Reconcile TDS deducted in books with Form 26AS", "Phase | Timeline | Focus Area | Reconciliation Types | Milestones &", "Phase 1 \\u2013 Core Launch | High-frequency, compliance-critical recons | 1. Bank"], "Dominant capability/theme (1 phrase)": "MR Reconciliation Txn", "Evidence": ["sheet:Recon List:row:3", "sheet:Recon List:row:4", "sheet:Recon List:row:5"], "Confidence": "High"}, "llm_runtime": {"provider": "vertex_gemini", "model": "gemini-2.5-flash", "attempted": true, "success": true, "error": ""}, "parser_coverage": {"units_processed": 177, "refs_sample": ["sheet:Recon List:row:3", "sheet:Recon List:row:4", "sheet:Recon List:row:5", "sheet:Recon List:row:6", "sheet:Recon List:row:7", "sheet:Recon List:row:8", "sheet:Recon List:row:9", "sheet:Recon List:row:10", "sheet:Recon List:row:11", "sheet:Recon List:row:12", "sheet:Recon List:row:13", "sheet:Recon List:row:14"], "pages_detected": []}, "analysis_run": {"run_at": "2026-02-09T12:12:07.014076", "run_id": "c8ec75a4cc4a", "forced": true}, "roadmap_candidate": {"Title": "Intelligent Financial Reconciliation Platform", "Intent": "Enable automated document understanding and confidence-based workflow decisions.", "Scope": "Automate high-frequency financial reconciliations with ML-driven insights and workflow actions.", "Activities": ["Establish core reconciliation matching framework.", "Define develop ML models for match confidence and prediction.", "Implement prescriptive actions for reconciliation items.", "Define create interactive dashboards for reconciliation management.", "Define integrate with source systems for data ingestion."], "Evidence": ["sheet:Recon List:row:5", "sheet:Priority:row:4", "sheet:Priority:row:14", "sheet:Priority:row:15", "sheet:Priority:row:16", "sheet:Priority:row:17"], "Confidence": "High"}}	2026-02-09 12:12:07.024079	2026-02-09 12:13:26.525995
25	34	BRD	High	{"document_understanding_check": {"Primary intent (1 sentence)": "Enable automated document understanding and confidence-based workflow decisions.", "Explicit outcomes (bullet list)": ["EXECUTIVE ROI DASHBOARD (FIRST SCREEN)", "SERVICE OPERATIONS DASHBOARD", "Avg Dispatch Time", "Avg Fix Time", "Repeat Ticket %"], "Dominant capability/theme (1 phrase)": "AI Concierge Platform", "Evidence": ["paragraph:2", "paragraph:3", "paragraph:4"], "Confidence": "High"}, "llm_runtime": {"provider": "vertex_gemini", "model": "gemini-2.5-flash", "attempted": true, "success": true, "error": ""}, "parser_coverage": {"units_processed": 449, "refs_sample": ["paragraph:2", "paragraph:3", "paragraph:4", "paragraph:5", "paragraph:7", "paragraph:8", "paragraph:9", "paragraph:10", "paragraph:11", "paragraph:12", "paragraph:13", "paragraph:14"], "pages_detected": []}, "analysis_run": {"run_at": "2026-02-09T12:14:23.651208", "run_id": "b62ea4d6d4e0", "forced": true}, "roadmap_candidate": {"Title": "AI Concierge Performance Dashboards", "Intent": "Provide comprehensive, measurable insights into the AI Concierge Platform's business impact and operational effectiveness for various stakeholders.", "Scope": "This covers the design, content, and key metrics for seven distinct dashboards: Executive ROI, Service Operations, Revenue & Bookings, Loyalty & Recognition, Guest Experience, Marketing Intelligence, and Risk, QA & Compl", "Activities": ["Define executive ROI and platform value metrics", "Design operational and financial performance dashboards", "Define develop loyalty and guest experience reporting", "Define build marketing intelligence and compliance views"], "Evidence": ["paragraph:2", "paragraph:3", "paragraph:4"], "Confidence": "High"}}	2026-02-09 12:14:23.661968	2026-02-09 12:22:31.603347
26	35	BRD	High	{"document_understanding_check": {"Primary intent (1 sentence)": "Many citizens, especially in rural and tribal communities, do not fully understand the full scope of 104 services.", "Explicit outcomes (bullet list)": ["Z-Agent fits this need perfectly. It becomes the intelligent layer that connects", "Access & Awareness Gaps", "Volume Spikes, Poor Triage & Queue Management", "Human Resource Constraints", "Technology Limitations"], "Dominant capability/theme (1 phrase)": "104 HealthCare Helpline", "Evidence": ["paragraph:7", "paragraph:10", "paragraph:11"], "Confidence": "High"}, "llm_runtime": {"provider": "vertex_gemini", "model": "gemini-2.5-flash", "attempted": true, "success": true, "error": ""}, "parser_coverage": {"units_processed": 334, "refs_sample": ["paragraph:7", "paragraph:10", "paragraph:11", "paragraph:12", "paragraph:13", "paragraph:15", "paragraph:16", "paragraph:17", "paragraph:18", "paragraph:21", "paragraph:22", "paragraph:23"], "pages_detected": []}, "analysis_run": {"run_at": "2026-02-09T12:23:48.995837", "run_id": "791e79875e50", "forced": true}, "roadmap_candidate": {"Title": "104 HealthCare Helpline Modernization", "Intent": "Transform the 104 HealthCare Helpline to improve citizen access, service quality, and operational efficiency through AI-enabled capabilities.", "Scope": "Implement the Z-Agent platform to unify and automate services for the Jharkhand 104 HealthCare Helpline, encompassing data integration, AI-driven citizen support, and operational dashboards.", "Activities": ["Establish integrated health data warehouse", "Define deploy AI-powered citizen interaction agents", "Define integrate with external government health APIs", "Define provide real-time operational and governance dashboards"], "Evidence": ["paragraph:7", "paragraph:10", "paragraph:11", "paragraph:12", "paragraph:18", "paragraph:51"], "Confidence": "High"}}	2026-02-09 12:23:49.00515	2026-02-09 12:24:10.910264
27	36	BRD	High	{"document_understanding_check": {"Primary intent (1 sentence)": "A ssistant T ransf orming emplo y ee r ecor ds int o a secur e,.", "Explicit outcomes (bullet list)": ["Clarify business objective", "Confirm explicit expected outcomes"], "Dominant capability/theme (1 phrase)": "HR Intelligence Brochure", "Evidence": ["page:1:line:1", "page:1:line:2", "page:1:line:3"], "Confidence": "High"}, "llm_runtime": {"provider": "vertex_gemini", "model": "gemini-2.5-flash", "attempted": true, "success": true, "error": ""}, "parser_coverage": {"units_processed": 139, "refs_sample": ["page:1:line:1", "page:1:line:2", "page:1:line:3", "page:1:line:4", "page:1:line:5", "page:1:line:6", "page:1:line:7", "page:1:line:8", "page:1:line:9", "page:1:line:10", "page:1:line:11", "page:1:line:12"], "pages_detected": [1, 2, 3, 4]}, "analysis_run": {"run_at": "2026-02-09T12:24:56.887565", "run_id": "666edf287265", "forced": true}, "roadmap_candidate": {"Title": "HR Intelligence Assistant Program", "Intent": "Deliver an AI-powered HR knowledge assistant to enhance HR efficiency, strategic talent utilization, and compliance.", "Scope": "Establish a secure, AI-driven HR knowledge and skill intelligence system within a 90-day pilot.", "Activities": ["Define ingest and digitize all HR records", "Define construct HR knowledge and skill graphs", "Implement AI-driven Q&A workflows", "Define ensure private, compliant data handling", "Define pilot with 1000 employee records"], "Evidence": ["page:1:line:1", "page:1:line:2", "page:1:line:3", "page:1:line:6", "page:1:line:7", "page:1:line:8"], "Confidence": "High"}}	2026-02-09 12:24:56.893068	2026-02-09 12:25:31.602957
\.


--
-- Data for Name: intake_item_versions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.intake_item_versions (id, intake_item_id, action, changed_by, changed_fields, before_data, after_data, created_at) FROM stdin;
62	24	agent_analyze	\N	["document_class", "title", "scope", "activities", "priority", "project_context", "initiative_type", "status"]	{}	{"document_class": "brd", "title": "", "scope": "", "activities": [], "priority": "medium", "project_context": "internal", "initiative_type": "new_product", "status": "understanding_pending", "roadmap_item_id": null}	2026-02-08 13:57:03.200431
63	24	understanding_approved	1	["title", "scope", "activities", "status"]	{"document_class": "brd", "title": "", "scope": "", "activities": [], "priority": "medium", "project_context": "internal", "initiative_type": "new_product", "status": "understanding_pending", "roadmap_item_id": null}	{"document_class": "brd", "title": "SmartDoc Document Intelligence Platform", "scope": "Process unstructured documents from ingestion through intelligent extraction, confidence-based routing, and enterprise system integration.", "activities": ["Define ingest documents from diverse sources.", "Define classify document types and intent.", "Define extract data with confidence scores.", "Define route outcomes based on confidence thresholds.", "Define integrate with core enterprise systems."], "priority": "medium", "project_context": "internal", "initiative_type": "new_product", "status": "draft", "roadmap_item_id": null}	2026-02-08 13:57:16.099242
64	24	approved	1	["status", "roadmap_item_id"]	{"document_class": "brd", "title": "SmartDoc Document Intelligence Platform", "scope": "Process unstructured documents from ingestion through intelligent extraction, confidence-based routing, and enterprise system integration.", "activities": ["Define ingest documents from diverse sources.", "Define classify document types and intent.", "Define extract data with confidence scores.", "Define route outcomes based on confidence thresholds.", "Define integrate with core enterprise systems."], "priority": "medium", "project_context": "internal", "initiative_type": "new_product", "status": "draft", "roadmap_item_id": null}	{"document_class": "brd", "title": "SmartDoc Document Intelligence Platform", "scope": "Process unstructured documents from ingestion through intelligent extraction, confidence-based routing, and enterprise system integration.", "activities": ["Define ingest documents from diverse sources.", "Define classify document types and intent.", "Define extract data with confidence scores.", "Define route outcomes based on confidence thresholds.", "Define integrate with core enterprise systems."], "priority": "medium", "project_context": "internal", "initiative_type": "new_product", "status": "approved", "roadmap_item_id": 14}	2026-02-08 13:57:19.896234
65	25	agent_analyze	\N	["document_class", "title", "scope", "activities", "priority", "project_context", "initiative_type", "status"]	{}	{"document_class": "brd", "title": "", "scope": "", "activities": [], "priority": "medium", "project_context": "internal", "initiative_type": "new_product", "status": "understanding_pending", "roadmap_item_id": null}	2026-02-08 13:58:08.104789
66	25	understanding_approved	1	["title", "scope", "activities", "status"]	{"document_class": "brd", "title": "", "scope": "", "activities": [], "priority": "medium", "project_context": "internal", "initiative_type": "new_product", "status": "understanding_pending", "roadmap_item_id": null}	{"document_class": "brd", "title": "Automated Vendor Onboarding Platform", "scope": "\\u2022 Country-specific tax and regulatory requirements GST, VAT, PAN, EIN, UEN, TRN\\u2014vendors are guided through only what applies to them, no more, no less.", "activities": ["Implement secure vendor identity verification.", "Define automate compliance checks and requirements.", "Define extract and validate document data via AI.", "Define integrate risk, AML, and sanctions screening.", "Define orchestrate approval workflows and system activation."], "priority": "medium", "project_context": "internal", "initiative_type": "new_product", "status": "draft", "roadmap_item_id": null}	2026-02-08 13:58:45.046931
81	31	agent_analyze	\N	["document_class", "title", "scope", "activities", "priority", "project_context", "initiative_type", "delivery_mode", "rnd_hypothesis", "rnd_experiment_goal", "rnd_success_criteria", "rnd_decision_date", "rnd_next_gate", "rnd_risk_level", "status"]	{}	{"document_class": "brd", "title": "", "scope": "", "activities": [], "priority": "high", "project_context": "internal", "initiative_type": "new_feature", "delivery_mode": "standard", "rnd_hypothesis": "", "rnd_experiment_goal": "", "rnd_success_criteria": "", "rnd_timebox_weeks": null, "rnd_decision_date": "", "rnd_next_gate": "", "rnd_risk_level": "", "status": "understanding_pending", "roadmap_item_id": null}	2026-02-09 12:04:51.579865
91	35	agent_analyze	\N	["document_class", "title", "scope", "activities", "priority", "project_context", "initiative_type", "delivery_mode", "rnd_hypothesis", "rnd_experiment_goal", "rnd_success_criteria", "rnd_decision_date", "rnd_next_gate", "rnd_risk_level", "status"]	{}	{"document_class": "brd", "title": "", "scope": "", "activities": [], "priority": "medium", "project_context": "internal", "initiative_type": "new_feature", "delivery_mode": "standard", "rnd_hypothesis": "", "rnd_experiment_goal": "", "rnd_success_criteria": "", "rnd_timebox_weeks": null, "rnd_decision_date": "", "rnd_next_gate": "", "rnd_risk_level": "", "status": "understanding_pending", "roadmap_item_id": null}	2026-02-09 12:23:49.006374
93	35	approved	1	["status", "roadmap_item_id"]	{"document_class": "brd", "title": "104 HealthCare Helpline Modernization", "scope": "Implement the Z-Agent platform to unify and automate services for the Jharkhand 104 HealthCare Helpline, encompassing data integration, AI-driven citizen support, and operational dashboards.", "activities": ["Establish integrated health data warehouse", "Define deploy AI-powered citizen interaction agents", "Define integrate with external government health APIs", "Define provide real-time operational and governance dashboards"], "priority": "medium", "project_context": "internal", "initiative_type": "new_feature", "delivery_mode": "standard", "rnd_hypothesis": "", "rnd_experiment_goal": "", "rnd_success_criteria": "", "rnd_timebox_weeks": null, "rnd_decision_date": "", "rnd_next_gate": "", "rnd_risk_level": "", "status": "draft", "roadmap_item_id": null}	{"document_class": "brd", "title": "104 HealthCare Helpline Modernization", "scope": "Implement the Z-Agent platform to unify and automate services for the Jharkhand 104 HealthCare Helpline, encompassing data integration, AI-driven citizen support, and operational dashboards.", "activities": ["Establish integrated health data warehouse", "Define deploy AI-powered citizen interaction agents", "Define integrate with external government health APIs", "Define provide real-time operational and governance dashboards"], "priority": "medium", "project_context": "internal", "initiative_type": "new_feature", "delivery_mode": "standard", "rnd_hypothesis": "", "rnd_experiment_goal": "", "rnd_success_criteria": "", "rnd_timebox_weeks": null, "rnd_decision_date": "", "rnd_next_gate": "", "rnd_risk_level": "", "status": "approved", "roadmap_item_id": 23}	2026-02-09 12:24:19.792478
67	25	approved	1	["status", "roadmap_item_id"]	{"document_class": "brd", "title": "Automated Vendor Onboarding Platform", "scope": "\\u2022 Country-specific tax and regulatory requirements GST, VAT, PAN, EIN, UEN, TRN\\u2014vendors are guided through only what applies to them, no more, no less.", "activities": ["Implement secure vendor identity verification.", "Define automate compliance checks and requirements.", "Define extract and validate document data via AI.", "Define integrate risk, AML, and sanctions screening.", "Define orchestrate approval workflows and system activation."], "priority": "medium", "project_context": "internal", "initiative_type": "new_product", "status": "draft", "roadmap_item_id": null}	{"document_class": "brd", "title": "Automated Vendor Onboarding Platform", "scope": "\\u2022 Country-specific tax and regulatory requirements GST, VAT, PAN, EIN, UEN, TRN\\u2014vendors are guided through only what applies to them, no more, no less.", "activities": ["Implement secure vendor identity verification.", "Define automate compliance checks and requirements.", "Define extract and validate document data via AI.", "Define integrate risk, AML, and sanctions screening.", "Define orchestrate approval workflows and system activation."], "priority": "medium", "project_context": "internal", "initiative_type": "new_product", "status": "approved", "roadmap_item_id": 15}	2026-02-08 13:58:50.448101
68	26	agent_analyze	\N	["document_class", "title", "scope", "activities", "priority", "project_context", "initiative_type", "delivery_mode", "rnd_hypothesis", "rnd_experiment_goal", "rnd_success_criteria", "rnd_decision_date", "rnd_next_gate", "rnd_risk_level", "status"]	{}	{"document_class": "brd", "title": "", "scope": "", "activities": [], "priority": "medium", "project_context": "client", "initiative_type": "new_feature", "delivery_mode": "rnd", "rnd_hypothesis": "Test", "rnd_experiment_goal": "Test", "rnd_success_criteria": "Test", "rnd_timebox_weeks": null, "rnd_decision_date": "", "rnd_next_gate": "pivot", "rnd_risk_level": "low", "status": "understanding_pending", "roadmap_item_id": null}	2026-02-09 04:55:16.613471
69	26	understanding_approved	1	["title", "scope", "activities", "status"]	{"document_class": "brd", "title": "", "scope": "", "activities": [], "priority": "medium", "project_context": "client", "initiative_type": "new_feature", "delivery_mode": "rnd", "rnd_hypothesis": "Test", "rnd_experiment_goal": "Test", "rnd_success_criteria": "Test", "rnd_timebox_weeks": null, "rnd_decision_date": "", "rnd_next_gate": "pivot", "rnd_risk_level": "low", "status": "understanding_pending", "roadmap_item_id": null}	{"document_class": "brd", "title": "Financial Services Provider Engagement", "scope": "This covers the independent statutory audit and year-round tax and financial advisory for PBVFOWA for the Financial Year 2025-2026, with potential for split engagements.", "activities": ["Define conduct statutory audit and financial reporting", "Define manage tax compliance and representation", "Define provide strategic financial advisory", "Define deliver independent audit reports and tax filings", "Define report bylaw non-compliance and recommend rectification"], "priority": "medium", "project_context": "client", "initiative_type": "new_feature", "delivery_mode": "rnd", "rnd_hypothesis": "Test", "rnd_experiment_goal": "Test", "rnd_success_criteria": "Test", "rnd_timebox_weeks": null, "rnd_decision_date": "", "rnd_next_gate": "pivot", "rnd_risk_level": "low", "status": "draft", "roadmap_item_id": null}	2026-02-09 04:55:51.915313
70	26	approved	1	["status", "roadmap_item_id"]	{"document_class": "brd", "title": "Financial Services Provider Engagement", "scope": "This covers the independent statutory audit and year-round tax and financial advisory for PBVFOWA for the Financial Year 2025-2026, with potential for split engagements.", "activities": ["Define conduct statutory audit and financial reporting", "Define manage tax compliance and representation", "Define provide strategic financial advisory", "Define deliver independent audit reports and tax filings", "Define report bylaw non-compliance and recommend rectification"], "priority": "medium", "project_context": "client", "initiative_type": "new_feature", "delivery_mode": "rnd", "rnd_hypothesis": "Test", "rnd_experiment_goal": "Test", "rnd_success_criteria": "Test", "rnd_timebox_weeks": null, "rnd_decision_date": "", "rnd_next_gate": "pivot", "rnd_risk_level": "low", "status": "draft", "roadmap_item_id": null}	{"document_class": "brd", "title": "Financial Services Provider Engagement", "scope": "This covers the independent statutory audit and year-round tax and financial advisory for PBVFOWA for the Financial Year 2025-2026, with potential for split engagements.", "activities": ["Define conduct statutory audit and financial reporting", "Define manage tax compliance and representation", "Define provide strategic financial advisory", "Define deliver independent audit reports and tax filings", "Define report bylaw non-compliance and recommend rectification"], "priority": "medium", "project_context": "client", "initiative_type": "new_feature", "delivery_mode": "rnd", "rnd_hypothesis": "Test", "rnd_experiment_goal": "Test", "rnd_success_criteria": "Test", "rnd_timebox_weeks": null, "rnd_decision_date": "", "rnd_next_gate": "pivot", "rnd_risk_level": "low", "status": "approved", "roadmap_item_id": 16}	2026-02-09 04:55:56.705335
71	25	approved	1	["status", "roadmap_item_id"]	{"document_class": "brd", "title": "Automated Vendor Onboarding Platform", "scope": "\\u2022 Country-specific tax and regulatory requirements GST, VAT, PAN, EIN, UEN, TRN\\u2014vendors are guided through only what applies to them, no more, no less.", "activities": ["Implement secure vendor identity verification.", "Define automate compliance checks and requirements.", "Define extract and validate document data via AI.", "Define integrate risk, AML, and sanctions screening.", "Define orchestrate approval workflows and system activation."], "priority": "medium", "project_context": "internal", "initiative_type": "new_product", "delivery_mode": "standard", "rnd_hypothesis": "", "rnd_experiment_goal": "", "rnd_success_criteria": "", "rnd_timebox_weeks": null, "rnd_decision_date": "", "rnd_next_gate": "", "rnd_risk_level": "", "status": "draft", "roadmap_item_id": null}	{"document_class": "brd", "title": "Automated Vendor Onboarding Platform", "scope": "\\u2022 Country-specific tax and regulatory requirements GST, VAT, PAN, EIN, UEN, TRN\\u2014vendors are guided through only what applies to them, no more, no less.", "activities": ["Implement secure vendor identity verification.", "Define automate compliance checks and requirements.", "Define extract and validate document data via AI.", "Define integrate risk, AML, and sanctions screening.", "Define orchestrate approval workflows and system activation."], "priority": "medium", "project_context": "internal", "initiative_type": "new_product", "delivery_mode": "standard", "rnd_hypothesis": "", "rnd_experiment_goal": "", "rnd_success_criteria": "", "rnd_timebox_weeks": null, "rnd_decision_date": "", "rnd_next_gate": "", "rnd_risk_level": "", "status": "approved", "roadmap_item_id": 17}	2026-02-09 04:57:18.30656
72	27	agent_analyze	\N	["document_class", "title", "scope", "activities", "priority", "project_context", "initiative_type", "delivery_mode", "rnd_hypothesis", "rnd_experiment_goal", "rnd_success_criteria", "rnd_decision_date", "rnd_next_gate", "rnd_risk_level", "status"]	{}	{"document_class": "brd", "title": "", "scope": "", "activities": [], "priority": "medium", "project_context": "internal", "initiative_type": "new_product", "delivery_mode": "rnd", "rnd_hypothesis": "", "rnd_experiment_goal": "", "rnd_success_criteria": "", "rnd_timebox_weeks": null, "rnd_decision_date": "", "rnd_next_gate": "pivot", "rnd_risk_level": "low", "status": "understanding_pending", "roadmap_item_id": null}	2026-02-09 05:07:17.236593
73	27	understanding_approved	1	["title", "scope", "activities", "status"]	{"document_class": "brd", "title": "", "scope": "", "activities": [], "priority": "medium", "project_context": "internal", "initiative_type": "new_product", "delivery_mode": "rnd", "rnd_hypothesis": "", "rnd_experiment_goal": "", "rnd_success_criteria": "", "rnd_timebox_weeks": null, "rnd_decision_date": "", "rnd_next_gate": "pivot", "rnd_risk_level": "low", "status": "understanding_pending", "roadmap_item_id": null}	{"document_class": "brd", "title": "104 Health Helpline System", "scope": "Manage citizen interactions from initial contact through resolution, backend automation, and follow-up monitoring.", "activities": ["Define process call intake and contextualization", "Define automate query resolution and triage", "Enable human and expert consultation", "Define automate backend workflows and closure", "Define monitor performance and ensure follow-up"], "priority": "medium", "project_context": "internal", "initiative_type": "new_product", "delivery_mode": "rnd", "rnd_hypothesis": "", "rnd_experiment_goal": "", "rnd_success_criteria": "", "rnd_timebox_weeks": null, "rnd_decision_date": "", "rnd_next_gate": "pivot", "rnd_risk_level": "low", "status": "draft", "roadmap_item_id": null}	2026-02-09 05:10:35.407755
74	27	approved	1	["status", "roadmap_item_id"]	{"document_class": "brd", "title": "104 Health Helpline System", "scope": "Manage citizen interactions from initial contact through resolution, backend automation, and follow-up monitoring.", "activities": ["Define process call intake and contextualization", "Define automate query resolution and triage", "Enable human and expert consultation", "Define automate backend workflows and closure", "Define monitor performance and ensure follow-up"], "priority": "medium", "project_context": "internal", "initiative_type": "new_product", "delivery_mode": "rnd", "rnd_hypothesis": "", "rnd_experiment_goal": "", "rnd_success_criteria": "", "rnd_timebox_weeks": null, "rnd_decision_date": "", "rnd_next_gate": "pivot", "rnd_risk_level": "low", "status": "draft", "roadmap_item_id": null}	{"document_class": "brd", "title": "104 Health Helpline System", "scope": "Manage citizen interactions from initial contact through resolution, backend automation, and follow-up monitoring.", "activities": ["Define process call intake and contextualization", "Define automate query resolution and triage", "Enable human and expert consultation", "Define automate backend workflows and closure", "Define monitor performance and ensure follow-up"], "priority": "medium", "project_context": "internal", "initiative_type": "new_product", "delivery_mode": "rnd", "rnd_hypothesis": "", "rnd_experiment_goal": "", "rnd_success_criteria": "", "rnd_timebox_weeks": null, "rnd_decision_date": "", "rnd_next_gate": "pivot", "rnd_risk_level": "low", "status": "approved", "roadmap_item_id": 18}	2026-02-09 05:10:44.048246
75	28	agent_analyze	\N	["document_class", "title", "scope", "activities", "priority", "project_context", "initiative_type", "delivery_mode", "rnd_hypothesis", "rnd_experiment_goal", "rnd_success_criteria", "rnd_decision_date", "rnd_next_gate", "rnd_risk_level", "status"]	{}	{"document_class": "brd", "title": "", "scope": "", "activities": [], "priority": "medium", "project_context": "client", "initiative_type": "new_feature", "delivery_mode": "standard", "rnd_hypothesis": "", "rnd_experiment_goal": "", "rnd_success_criteria": "", "rnd_timebox_weeks": null, "rnd_decision_date": "", "rnd_next_gate": "", "rnd_risk_level": "", "status": "understanding_pending", "roadmap_item_id": null}	2026-02-09 05:45:28.594056
78	30	agent_analyze	\N	["document_class", "title", "scope", "activities", "priority", "project_context", "initiative_type", "delivery_mode", "rnd_hypothesis", "rnd_experiment_goal", "rnd_success_criteria", "rnd_decision_date", "rnd_next_gate", "rnd_risk_level", "status"]	{}	{"document_class": "brd", "title": "", "scope": "", "activities": [], "priority": "high", "project_context": "internal", "initiative_type": "new_feature", "delivery_mode": "standard", "rnd_hypothesis": "", "rnd_experiment_goal": "", "rnd_success_criteria": "", "rnd_timebox_weeks": null, "rnd_decision_date": "", "rnd_next_gate": "", "rnd_risk_level": "", "status": "understanding_pending", "roadmap_item_id": null}	2026-02-09 12:01:28.645414
79	30	understanding_approved	1	["title", "scope", "activities", "status"]	{"document_class": "brd", "title": "", "scope": "", "activities": [], "priority": "high", "project_context": "internal", "initiative_type": "new_feature", "delivery_mode": "standard", "rnd_hypothesis": "", "rnd_experiment_goal": "", "rnd_success_criteria": "", "rnd_timebox_weeks": null, "rnd_decision_date": "", "rnd_next_gate": "", "rnd_risk_level": "", "status": "understanding_pending", "roadmap_item_id": null}	{"document_class": "brd", "title": "Financial Document Processing Automation", "scope": "This covers ingesting, classifying, extracting, and verifying various financial documents from defined input sources for Z-TRANSACT.", "activities": ["Define ingest documents from specified sources", "Define auto-classify diverse financial document types", "Define extract required data fields from documents", "Define apply document-specific verification criteria", "Define process documents regardless of layout"], "priority": "high", "project_context": "internal", "initiative_type": "new_feature", "delivery_mode": "standard", "rnd_hypothesis": "", "rnd_experiment_goal": "", "rnd_success_criteria": "", "rnd_timebox_weeks": null, "rnd_decision_date": "", "rnd_next_gate": "", "rnd_risk_level": "", "status": "draft", "roadmap_item_id": null}	2026-02-09 12:01:51.297664
80	30	approved	1	["status", "roadmap_item_id"]	{"document_class": "brd", "title": "Financial Document Processing Automation", "scope": "This covers ingesting, classifying, extracting, and verifying various financial documents from defined input sources for Z-TRANSACT.", "activities": ["Define ingest documents from specified sources", "Define auto-classify diverse financial document types", "Define extract required data fields from documents", "Define apply document-specific verification criteria", "Define process documents regardless of layout"], "priority": "high", "project_context": "internal", "initiative_type": "new_feature", "delivery_mode": "standard", "rnd_hypothesis": "", "rnd_experiment_goal": "", "rnd_success_criteria": "", "rnd_timebox_weeks": null, "rnd_decision_date": "", "rnd_next_gate": "", "rnd_risk_level": "", "status": "draft", "roadmap_item_id": null}	{"document_class": "brd", "title": "Financial Document Processing Automation", "scope": "This covers ingesting, classifying, extracting, and verifying various financial documents from defined input sources for Z-TRANSACT.", "activities": ["Define ingest documents from specified sources", "Define auto-classify diverse financial document types", "Define extract required data fields from documents", "Define apply document-specific verification criteria", "Define process documents regardless of layout"], "priority": "high", "project_context": "internal", "initiative_type": "new_feature", "delivery_mode": "standard", "rnd_hypothesis": "", "rnd_experiment_goal": "", "rnd_success_criteria": "", "rnd_timebox_weeks": null, "rnd_decision_date": "", "rnd_next_gate": "", "rnd_risk_level": "", "status": "approved", "roadmap_item_id": 19}	2026-02-09 12:02:12.752538
82	31	understanding_approved	1	["title", "scope", "activities", "status"]	{"document_class": "brd", "title": "", "scope": "", "activities": [], "priority": "high", "project_context": "internal", "initiative_type": "new_feature", "delivery_mode": "standard", "rnd_hypothesis": "", "rnd_experiment_goal": "", "rnd_success_criteria": "", "rnd_timebox_weeks": null, "rnd_decision_date": "", "rnd_next_gate": "", "rnd_risk_level": "", "status": "understanding_pending", "roadmap_item_id": null}	{"document_class": "brd", "title": "Comprehensive Reconciliation Framework", "scope": "Encompasses bank, credit card, AP, AR, intercompany, payroll, expense, cash, inventory, and tax reconciliations.", "activities": ["Standardize data ingestion processes", "Define automate transaction matching logic", "Identify and categorize all discrepancies", "Define streamline discrepancy resolution workflows", "Define generate compliance and audit trails"], "priority": "high", "project_context": "internal", "initiative_type": "new_feature", "delivery_mode": "standard", "rnd_hypothesis": "", "rnd_experiment_goal": "", "rnd_success_criteria": "", "rnd_timebox_weeks": null, "rnd_decision_date": "", "rnd_next_gate": "", "rnd_risk_level": "", "status": "draft", "roadmap_item_id": null}	2026-02-09 12:05:16.516166
83	31	approved	1	["status", "roadmap_item_id"]	{"document_class": "brd", "title": "Comprehensive Reconciliation Framework", "scope": "Encompasses bank, credit card, AP, AR, intercompany, payroll, expense, cash, inventory, and tax reconciliations.", "activities": ["Standardize data ingestion processes", "Define automate transaction matching logic", "Identify and categorize all discrepancies", "Define streamline discrepancy resolution workflows", "Define generate compliance and audit trails"], "priority": "high", "project_context": "internal", "initiative_type": "new_feature", "delivery_mode": "standard", "rnd_hypothesis": "", "rnd_experiment_goal": "", "rnd_success_criteria": "", "rnd_timebox_weeks": null, "rnd_decision_date": "", "rnd_next_gate": "", "rnd_risk_level": "", "status": "draft", "roadmap_item_id": null}	{"document_class": "brd", "title": "Comprehensive Reconciliation Framework", "scope": "Encompasses bank, credit card, AP, AR, intercompany, payroll, expense, cash, inventory, and tax reconciliations.", "activities": ["Standardize data ingestion processes", "Define automate transaction matching logic", "Identify and categorize all discrepancies", "Define streamline discrepancy resolution workflows", "Define generate compliance and audit trails"], "priority": "high", "project_context": "internal", "initiative_type": "new_feature", "delivery_mode": "standard", "rnd_hypothesis": "", "rnd_experiment_goal": "", "rnd_success_criteria": "", "rnd_timebox_weeks": null, "rnd_decision_date": "", "rnd_next_gate": "", "rnd_risk_level": "", "status": "approved", "roadmap_item_id": 20}	2026-02-09 12:09:01.747317
85	33	agent_analyze	\N	["document_class", "title", "scope", "activities", "priority", "project_context", "initiative_type", "delivery_mode", "rnd_hypothesis", "rnd_experiment_goal", "rnd_success_criteria", "rnd_decision_date", "rnd_next_gate", "rnd_risk_level", "status"]	{}	{"document_class": "other", "title": "", "scope": "", "activities": [], "priority": "medium", "project_context": "internal", "initiative_type": "new_feature", "delivery_mode": "standard", "rnd_hypothesis": "", "rnd_experiment_goal": "", "rnd_success_criteria": "", "rnd_timebox_weeks": null, "rnd_decision_date": "", "rnd_next_gate": "", "rnd_risk_level": "", "status": "understanding_pending", "roadmap_item_id": null}	2026-02-09 12:12:07.025232
86	33	understanding_approved	1	["title", "scope", "activities", "status"]	{"document_class": "other", "title": "", "scope": "", "activities": [], "priority": "medium", "project_context": "internal", "initiative_type": "new_feature", "delivery_mode": "standard", "rnd_hypothesis": "", "rnd_experiment_goal": "", "rnd_success_criteria": "", "rnd_timebox_weeks": null, "rnd_decision_date": "", "rnd_next_gate": "", "rnd_risk_level": "", "status": "understanding_pending", "roadmap_item_id": null}	{"document_class": "other", "title": "Intelligent Financial Reconciliation Platform", "scope": "Automate high-frequency financial reconciliations with ML-driven insights and workflow actions.", "activities": ["Establish core reconciliation matching framework.", "Define develop ML models for match confidence and prediction.", "Implement prescriptive actions for reconciliation items.", "Define create interactive dashboards for reconciliation management.", "Define integrate with source systems for data ingestion."], "priority": "medium", "project_context": "internal", "initiative_type": "new_feature", "delivery_mode": "standard", "rnd_hypothesis": "", "rnd_experiment_goal": "", "rnd_success_criteria": "", "rnd_timebox_weeks": null, "rnd_decision_date": "", "rnd_next_gate": "", "rnd_risk_level": "", "status": "draft", "roadmap_item_id": null}	2026-02-09 12:13:26.527466
88	34	agent_analyze	\N	["document_class", "title", "scope", "activities", "priority", "project_context", "initiative_type", "delivery_mode", "rnd_hypothesis", "rnd_experiment_goal", "rnd_success_criteria", "rnd_decision_date", "rnd_next_gate", "rnd_risk_level", "status"]	{}	{"document_class": "brd", "title": "", "scope": "", "activities": [], "priority": "medium", "project_context": "internal", "initiative_type": "new_product", "delivery_mode": "rnd", "rnd_hypothesis": "", "rnd_experiment_goal": "", "rnd_success_criteria": "", "rnd_timebox_weeks": null, "rnd_decision_date": "", "rnd_next_gate": "pivot", "rnd_risk_level": "low", "status": "understanding_pending", "roadmap_item_id": null}	2026-02-09 12:14:23.664852
87	33	approved	1	["status", "roadmap_item_id"]	{"document_class": "other", "title": "Intelligent Financial Reconciliation Platform", "scope": "Automate high-frequency financial reconciliations with ML-driven insights and workflow actions.", "activities": ["Establish core reconciliation matching framework.", "Define develop ML models for match confidence and prediction.", "Implement prescriptive actions for reconciliation items.", "Define create interactive dashboards for reconciliation management.", "Define integrate with source systems for data ingestion."], "priority": "medium", "project_context": "internal", "initiative_type": "new_feature", "delivery_mode": "standard", "rnd_hypothesis": "", "rnd_experiment_goal": "", "rnd_success_criteria": "", "rnd_timebox_weeks": null, "rnd_decision_date": "", "rnd_next_gate": "", "rnd_risk_level": "", "status": "draft", "roadmap_item_id": null}	{"document_class": "other", "title": "Intelligent Financial Reconciliation Platform", "scope": "Automate high-frequency financial reconciliations with ML-driven insights and workflow actions.", "activities": ["Establish core reconciliation matching framework.", "Define develop ML models for match confidence and prediction.", "Implement prescriptive actions for reconciliation items.", "Define create interactive dashboards for reconciliation management.", "Define integrate with source systems for data ingestion."], "priority": "medium", "project_context": "internal", "initiative_type": "new_feature", "delivery_mode": "standard", "rnd_hypothesis": "", "rnd_experiment_goal": "", "rnd_success_criteria": "", "rnd_timebox_weeks": null, "rnd_decision_date": "", "rnd_next_gate": "", "rnd_risk_level": "", "status": "approved", "roadmap_item_id": 21}	2026-02-09 12:13:40.12531
89	34	understanding_approved	1	["title", "scope", "activities", "status"]	{"document_class": "brd", "title": "", "scope": "", "activities": [], "priority": "medium", "project_context": "internal", "initiative_type": "new_product", "delivery_mode": "rnd", "rnd_hypothesis": "", "rnd_experiment_goal": "", "rnd_success_criteria": "", "rnd_timebox_weeks": null, "rnd_decision_date": "", "rnd_next_gate": "pivot", "rnd_risk_level": "low", "status": "understanding_pending", "roadmap_item_id": null}	{"document_class": "brd", "title": "AI Concierge Performance Dashboards", "scope": "This covers the design, content, and key metrics for seven distinct dashboards: Executive ROI, Service Operations, Revenue & Bookings, Loyalty & Recognition, Guest Experience, Marketing Intelligence, and Risk, QA & Compl", "activities": ["Define executive ROI and platform value metrics", "Design operational and financial performance dashboards", "Define develop loyalty and guest experience reporting", "Define build marketing intelligence and compliance views"], "priority": "medium", "project_context": "internal", "initiative_type": "new_product", "delivery_mode": "rnd", "rnd_hypothesis": "", "rnd_experiment_goal": "", "rnd_success_criteria": "", "rnd_timebox_weeks": null, "rnd_decision_date": "", "rnd_next_gate": "pivot", "rnd_risk_level": "low", "status": "draft", "roadmap_item_id": null}	2026-02-09 12:22:31.605121
90	34	approved	1	["status", "roadmap_item_id"]	{"document_class": "brd", "title": "AI Concierge Performance Dashboards", "scope": "This covers the design, content, and key metrics for seven distinct dashboards: Executive ROI, Service Operations, Revenue & Bookings, Loyalty & Recognition, Guest Experience, Marketing Intelligence, and Risk, QA & Compl", "activities": ["Define executive ROI and platform value metrics", "Design operational and financial performance dashboards", "Define develop loyalty and guest experience reporting", "Define build marketing intelligence and compliance views"], "priority": "medium", "project_context": "internal", "initiative_type": "new_product", "delivery_mode": "rnd", "rnd_hypothesis": "", "rnd_experiment_goal": "", "rnd_success_criteria": "", "rnd_timebox_weeks": null, "rnd_decision_date": "", "rnd_next_gate": "pivot", "rnd_risk_level": "low", "status": "draft", "roadmap_item_id": null}	{"document_class": "brd", "title": "AI Concierge Performance Dashboards", "scope": "This covers the design, content, and key metrics for seven distinct dashboards: Executive ROI, Service Operations, Revenue & Bookings, Loyalty & Recognition, Guest Experience, Marketing Intelligence, and Risk, QA & Compl", "activities": ["Define executive ROI and platform value metrics", "Design operational and financial performance dashboards", "Define develop loyalty and guest experience reporting", "Define build marketing intelligence and compliance views"], "priority": "medium", "project_context": "internal", "initiative_type": "new_product", "delivery_mode": "rnd", "rnd_hypothesis": "", "rnd_experiment_goal": "", "rnd_success_criteria": "", "rnd_timebox_weeks": null, "rnd_decision_date": "", "rnd_next_gate": "pivot", "rnd_risk_level": "low", "status": "approved", "roadmap_item_id": 22}	2026-02-09 12:23:11.062332
92	35	understanding_approved	1	["title", "scope", "activities", "status"]	{"document_class": "brd", "title": "", "scope": "", "activities": [], "priority": "medium", "project_context": "internal", "initiative_type": "new_feature", "delivery_mode": "standard", "rnd_hypothesis": "", "rnd_experiment_goal": "", "rnd_success_criteria": "", "rnd_timebox_weeks": null, "rnd_decision_date": "", "rnd_next_gate": "", "rnd_risk_level": "", "status": "understanding_pending", "roadmap_item_id": null}	{"document_class": "brd", "title": "104 HealthCare Helpline Modernization", "scope": "Implement the Z-Agent platform to unify and automate services for the Jharkhand 104 HealthCare Helpline, encompassing data integration, AI-driven citizen support, and operational dashboards.", "activities": ["Establish integrated health data warehouse", "Define deploy AI-powered citizen interaction agents", "Define integrate with external government health APIs", "Define provide real-time operational and governance dashboards"], "priority": "medium", "project_context": "internal", "initiative_type": "new_feature", "delivery_mode": "standard", "rnd_hypothesis": "", "rnd_experiment_goal": "", "rnd_success_criteria": "", "rnd_timebox_weeks": null, "rnd_decision_date": "", "rnd_next_gate": "", "rnd_risk_level": "", "status": "draft", "roadmap_item_id": null}	2026-02-09 12:24:10.913631
94	36	agent_analyze	\N	["document_class", "title", "scope", "activities", "priority", "project_context", "initiative_type", "delivery_mode", "rnd_hypothesis", "rnd_experiment_goal", "rnd_success_criteria", "rnd_decision_date", "rnd_next_gate", "rnd_risk_level", "status"]	{}	{"document_class": "brd", "title": "", "scope": "", "activities": [], "priority": "medium", "project_context": "internal", "initiative_type": "new_feature", "delivery_mode": "standard", "rnd_hypothesis": "", "rnd_experiment_goal": "", "rnd_success_criteria": "", "rnd_timebox_weeks": null, "rnd_decision_date": "", "rnd_next_gate": "", "rnd_risk_level": "", "status": "understanding_pending", "roadmap_item_id": null}	2026-02-09 12:24:56.894034
95	36	understanding_approved	1	["title", "scope", "activities", "status"]	{"document_class": "brd", "title": "", "scope": "", "activities": [], "priority": "medium", "project_context": "internal", "initiative_type": "new_feature", "delivery_mode": "standard", "rnd_hypothesis": "", "rnd_experiment_goal": "", "rnd_success_criteria": "", "rnd_timebox_weeks": null, "rnd_decision_date": "", "rnd_next_gate": "", "rnd_risk_level": "", "status": "understanding_pending", "roadmap_item_id": null}	{"document_class": "brd", "title": "HR Intelligence Assistant Program", "scope": "Establish a secure, AI-driven HR knowledge and skill intelligence system within a 90-day pilot.", "activities": ["Define ingest and digitize all HR records", "Define construct HR knowledge and skill graphs", "Implement AI-driven Q&A workflows", "Define ensure private, compliant data handling", "Define pilot with 1000 employee records"], "priority": "medium", "project_context": "internal", "initiative_type": "new_feature", "delivery_mode": "standard", "rnd_hypothesis": "", "rnd_experiment_goal": "", "rnd_success_criteria": "", "rnd_timebox_weeks": null, "rnd_decision_date": "", "rnd_next_gate": "", "rnd_risk_level": "", "status": "draft", "roadmap_item_id": null}	2026-02-09 12:25:31.604887
96	36	approved	1	["status", "roadmap_item_id"]	{"document_class": "brd", "title": "HR Intelligence Assistant Program", "scope": "Establish a secure, AI-driven HR knowledge and skill intelligence system within a 90-day pilot.", "activities": ["Define ingest and digitize all HR records", "Define construct HR knowledge and skill graphs", "Implement AI-driven Q&A workflows", "Define ensure private, compliant data handling", "Define pilot with 1000 employee records"], "priority": "medium", "project_context": "internal", "initiative_type": "new_feature", "delivery_mode": "standard", "rnd_hypothesis": "", "rnd_experiment_goal": "", "rnd_success_criteria": "", "rnd_timebox_weeks": null, "rnd_decision_date": "", "rnd_next_gate": "", "rnd_risk_level": "", "status": "draft", "roadmap_item_id": null}	{"document_class": "brd", "title": "HR Intelligence Assistant Program", "scope": "Establish a secure, AI-driven HR knowledge and skill intelligence system within a 90-day pilot.", "activities": ["Define ingest and digitize all HR records", "Define construct HR knowledge and skill graphs", "Implement AI-driven Q&A workflows", "Define ensure private, compliant data handling", "Define pilot with 1000 employee records"], "priority": "medium", "project_context": "internal", "initiative_type": "new_feature", "delivery_mode": "standard", "rnd_hypothesis": "", "rnd_experiment_goal": "", "rnd_success_criteria": "", "rnd_timebox_weeks": null, "rnd_decision_date": "", "rnd_next_gate": "", "rnd_risk_level": "", "status": "approved", "roadmap_item_id": 24}	2026-02-09 12:25:52.285851
\.


--
-- Data for Name: intake_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.intake_items (id, document_id, document_class, title, scope, activities, source_quotes, status, reviewed_by, roadmap_item_id, created_at, updated_at, priority, project_context, initiative_type, delivery_mode, rnd_hypothesis, rnd_experiment_goal, rnd_success_criteria, rnd_timebox_weeks, rnd_decision_date, rnd_next_gate, rnd_risk_level) FROM stdin;
28	31	brd			[]	["paragraph:2", "paragraph:3", "paragraph:4"]	understanding_pending	\N	\N	2026-02-09 05:45:28.578159	2026-02-09 05:45:28.578173	medium	client	new_feature	standard				\N			
26	29	brd	Financial Services Provider Engagement	This covers the independent statutory audit and year-round tax and financial advisory for PBVFOWA for the Financial Year 2025-2026, with potential for split engagements.	["Define conduct statutory audit and financial reporting", "Define manage tax compliance and representation", "Define provide strategic financial advisory", "Define deliver independent audit reports and tax filings", "Define report bylaw non-compliance and recommend rectification"]	["page:1:line:1", "page:2:line:1", "page:3:line:1"]	approved	1	16	2026-02-09 04:55:16.59869	2026-02-09 04:55:56.704208	medium	client	new_feature	rnd	Test	Test	Test	\N		pivot	low
24	27	brd	SmartDoc Document Intelligence Platform	Process unstructured documents from ingestion through intelligent extraction, confidence-based routing, and enterprise system integration.	["Define ingest documents from diverse sources.", "Define classify document types and intent.", "Define extract data with confidence scores.", "Define route outcomes based on confidence thresholds.", "Define integrate with core enterprise systems."]	["page:1:line:1", "page:1:line:16", "page:1:line:17", "page:1:line:18", "page:1:line:19", "page:2:line:3"]	approved	1	14	2026-02-08 13:57:03.189944	2026-02-08 13:57:19.894875	medium	internal	new_product	standard				\N			
25	28	brd	Automated Vendor Onboarding Platform	• Country-specific tax and regulatory requirements GST, VAT, PAN, EIN, UEN, TRN—vendors are guided through only what applies to them, no more, no less.	["Implement secure vendor identity verification.", "Define automate compliance checks and requirements.", "Define extract and validate document data via AI.", "Define integrate risk, AML, and sanctions screening.", "Define orchestrate approval workflows and system activation."]	["page:1:line:1", "page:1:line:13", "page:1:line:16", "page:1:line:21", "page:2:line:1", "page:2:line:2"]	approved	1	17	2026-02-08 13:58:08.100324	2026-02-09 04:57:18.305453	medium	internal	new_product	standard				\N			
31	72	brd	Comprehensive Reconciliation Framework	Encompasses bank, credit card, AP, AR, intercompany, payroll, expense, cash, inventory, and tax reconciliations.	["Standardize data ingestion processes", "Define automate transaction matching logic", "Identify and categorize all discrepancies", "Define streamline discrepancy resolution workflows", "Define generate compliance and audit trails"]	["paragraph:29"]	approved	1	20	2026-02-09 12:04:51.572168	2026-02-09 12:09:01.744996	high	internal	new_feature	standard				\N			
27	30	brd	104 Health Helpline System	Manage citizen interactions from initial contact through resolution, backend automation, and follow-up monitoring.	["Define process call intake and contextualization", "Define automate query resolution and triage", "Enable human and expert consultation", "Define automate backend workflows and closure", "Define monitor performance and ensure follow-up"]	["page:1:line:1", "page:1:line:2", "page:2:line:1"]	draft	1	\N	2026-02-09 05:07:17.221421	2026-02-10 05:40:21.614838	medium	internal	new_product	rnd				\N		pivot	low
30	73	brd	Financial Document Processing Automation	This covers ingesting, classifying, extracting, and verifying various financial documents from defined input sources for Z-TRANSACT.	["Define ingest documents from specified sources", "Define auto-classify diverse financial document types", "Define extract required data fields from documents", "Define apply document-specific verification criteria", "Define process documents regardless of layout"]	["paragraph:1", "paragraph:4", "paragraph:6", "paragraph:12", "paragraph:14", "paragraph:70"]	approved	1	19	2026-02-09 12:01:28.624056	2026-02-09 12:02:12.751123	high	internal	new_feature	standard				\N			
33	69	other	Intelligent Financial Reconciliation Platform	Automate high-frequency financial reconciliations with ML-driven insights and workflow actions.	["Establish core reconciliation matching framework.", "Define develop ML models for match confidence and prediction.", "Implement prescriptive actions for reconciliation items.", "Define create interactive dashboards for reconciliation management.", "Define integrate with source systems for data ingestion."]	["sheet:Recon List:row:5", "sheet:Priority:row:4", "sheet:Priority:row:14", "sheet:Priority:row:15", "sheet:Priority:row:16", "sheet:Priority:row:17"]	approved	1	21	2026-02-09 12:12:07.019686	2026-02-09 12:13:40.123481	medium	internal	new_feature	standard				\N			
35	41	brd	104 HealthCare Helpline Modernization	Implement the Z-Agent platform to unify and automate services for the Jharkhand 104 HealthCare Helpline, encompassing data integration, AI-driven citizen support, and operational dashboards.	["Establish integrated health data warehouse", "Define deploy AI-powered citizen interaction agents", "Define integrate with external government health APIs", "Define provide real-time operational and governance dashboards"]	["paragraph:7", "paragraph:10", "paragraph:11", "paragraph:12", "paragraph:18", "paragraph:51"]	approved	1	23	2026-02-09 12:23:48.998887	2026-02-09 12:24:19.790608	medium	internal	new_feature	standard				\N			
34	33	brd	AI Concierge Performance Dashboards	This covers the design, content, and key metrics for seven distinct dashboards: Executive ROI, Service Operations, Revenue & Bookings, Loyalty & Recognition, Guest Experience, Marketing Intelligence, and Risk, QA & Compl	["Define executive ROI and platform value metrics", "Design operational and financial performance dashboards", "Define develop loyalty and guest experience reporting", "Define build marketing intelligence and compliance views"]	["paragraph:2", "paragraph:3", "paragraph:4"]	draft	1	\N	2026-02-09 12:14:23.654338	2026-02-10 04:38:36.040387	medium	internal	new_product	rnd				\N		pivot	low
36	55	brd	HR Intelligence Assistant Program	Establish a secure, AI-driven HR knowledge and skill intelligence system within a 90-day pilot.	["Define ingest and digitize all HR records", "Define construct HR knowledge and skill graphs", "Implement AI-driven Q&A workflows", "Define ensure private, compliant data handling", "Define pilot with 1000 employee records"]	["page:1:line:1", "page:1:line:2", "page:1:line:3", "page:1:line:6", "page:1:line:7", "page:1:line:8"]	approved	1	24	2026-02-09 12:24:56.889934	2026-02-09 12:25:52.284082	medium	internal	new_feature	standard				\N			
\.


--
-- Data for Name: llm_configs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.llm_configs (id, provider, model, base_url, api_key, is_active, created_at) FROM stdin;
1	ollama	qwen2.5:7b	http://localhost:11434/v1		f	2026-02-06 07:36:21.22565
2	gemini	gemini-2.0-flash	http://localhost:11434/v1	AIzaSyCiayqw6mFsjfiLehILk-_niu1_SJYTWh0	f	2026-02-06 07:52:35.42455
3	gemini	gemini-2.0-flash		AIzaSyCiayqw6mFsjfiLehILk-_niu1_SJYTWh0	f	2026-02-06 08:12:28.325083
4	gemini	gemini-2.0-flash		bad-key	f	2026-02-07 02:55:48.847047
5	gemini	gemini-3-flash-preview		AIzaSyATvHiL-3EA3Dt8zGZBNaAUYJkA-xcUYTU	f	2026-02-07 02:58:10.607605
6	gemini	gemini-3-flash-preview		AIzaSyAAu6aaysurBdUz-cAvNha4l0vLeDZZXjw	f	2026-02-07 02:59:57.771155
7	vertex_gemini	gemini-2.5-flash	https://us-central1-aiplatform.googleapis.com/v1/projects/z-agent-dev/locations/us-central1/publishers/google/models		t	2026-02-07 11:37:29.190932
\.


--
-- Data for Name: projects; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.projects (id, name, description, project_type, status, progress_pct, target_date, owner_id, created_at) FROM stdin;
\.


--
-- Data for Name: roadmap_item_versions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.roadmap_item_versions (id, roadmap_item_id, action, changed_by, changed_fields, before_data, after_data, created_at) FROM stdin;
24	14	created_from_intake	1	["title", "scope", "activities", "priority", "project_context", "initiative_type", "accountable_person", "picked_up"]	{}	{"title": "SmartDoc Document Intelligence Platform", "scope": "Process unstructured documents from ingestion through intelligent extraction, confidence-based routing, and enterprise system integration.", "activities": ["Define ingest documents from diverse sources.", "Define classify document types and intent.", "Define extract data with confidence scores.", "Define route outcomes based on confidence thresholds.", "Define integrate with core enterprise systems."], "priority": "medium", "project_context": "internal", "initiative_type": "new_product", "accountable_person": "", "picked_up": false}	2026-02-08 13:57:19.898155
28	14	manual_update	1	["accountable_person", "picked_up"]	{"title": "SmartDoc Document Intelligence Platform", "scope": "Process unstructured documents from ingestion through intelligent extraction, confidence-based routing, and enterprise system integration.", "activities": ["Define ingest documents from diverse sources.", "Define classify document types and intent.", "Define extract data with confidence scores.", "Define route outcomes based on confidence thresholds.", "Define integrate with core enterprise systems."], "priority": "medium", "project_context": "internal", "initiative_type": "new_product", "accountable_person": "", "picked_up": false}	{"title": "SmartDoc Document Intelligence Platform", "scope": "Process unstructured documents from ingestion through intelligent extraction, confidence-based routing, and enterprise system integration.", "activities": ["Define ingest documents from diverse sources.", "Define classify document types and intent.", "Define extract data with confidence scores.", "Define route outcomes based on confidence thresholds.", "Define integrate with core enterprise systems."], "priority": "medium", "project_context": "internal", "initiative_type": "new_product", "accountable_person": "Madhu", "picked_up": true}	2026-02-09 03:52:09.783314
29	16	created_from_intake	1	["title", "scope", "activities", "priority", "project_context", "initiative_type", "delivery_mode", "rnd_hypothesis", "rnd_experiment_goal", "rnd_success_criteria", "rnd_decision_date", "rnd_next_gate", "rnd_risk_level", "accountable_person", "picked_up"]	{}	{"title": "Financial Services Provider Engagement", "scope": "This covers the independent statutory audit and year-round tax and financial advisory for PBVFOWA for the Financial Year 2025-2026, with potential for split engagements.", "activities": ["Define conduct statutory audit and financial reporting", "Define manage tax compliance and representation", "Define provide strategic financial advisory", "Define deliver independent audit reports and tax filings", "Define report bylaw non-compliance and recommend rectification"], "priority": "medium", "project_context": "client", "initiative_type": "new_feature", "delivery_mode": "rnd", "rnd_hypothesis": "Test", "rnd_experiment_goal": "Test", "rnd_success_criteria": "Test", "rnd_timebox_weeks": null, "rnd_decision_date": "", "rnd_next_gate": "pivot", "rnd_risk_level": "low", "accountable_person": "", "picked_up": false}	2026-02-09 04:55:56.706874
30	16	manual_update	1	["accountable_person", "picked_up"]	{"title": "Financial Services Provider Engagement", "scope": "This covers the independent statutory audit and year-round tax and financial advisory for PBVFOWA for the Financial Year 2025-2026, with potential for split engagements.", "activities": ["Define conduct statutory audit and financial reporting", "Define manage tax compliance and representation", "Define provide strategic financial advisory", "Define deliver independent audit reports and tax filings", "Define report bylaw non-compliance and recommend rectification"], "priority": "medium", "project_context": "client", "initiative_type": "new_feature", "delivery_mode": "rnd", "rnd_hypothesis": "Test", "rnd_experiment_goal": "Test", "rnd_success_criteria": "Test", "rnd_timebox_weeks": null, "rnd_decision_date": "", "rnd_next_gate": "pivot", "rnd_risk_level": "low", "accountable_person": "", "picked_up": false}	{"title": "Financial Services Provider Engagement", "scope": "This covers the independent statutory audit and year-round tax and financial advisory for PBVFOWA for the Financial Year 2025-2026, with potential for split engagements.", "activities": ["Define conduct statutory audit and financial reporting", "Define manage tax compliance and representation", "Define provide strategic financial advisory", "Define deliver independent audit reports and tax filings", "Define report bylaw non-compliance and recommend rectification"], "priority": "medium", "project_context": "client", "initiative_type": "new_feature", "delivery_mode": "rnd", "rnd_hypothesis": "Test", "rnd_experiment_goal": "Test", "rnd_success_criteria": "Test", "rnd_timebox_weeks": null, "rnd_decision_date": "", "rnd_next_gate": "pivot", "rnd_risk_level": "low", "accountable_person": "Madhu", "picked_up": true}	2026-02-09 04:56:18.463415
31	17	created_from_intake	1	["title", "scope", "activities", "priority", "project_context", "initiative_type", "delivery_mode", "rnd_hypothesis", "rnd_experiment_goal", "rnd_success_criteria", "rnd_decision_date", "rnd_next_gate", "rnd_risk_level", "accountable_person", "picked_up"]	{}	{"title": "Automated Vendor Onboarding Platform", "scope": "\\u2022 Country-specific tax and regulatory requirements GST, VAT, PAN, EIN, UEN, TRN\\u2014vendors are guided through only what applies to them, no more, no less.", "activities": ["Implement secure vendor identity verification.", "Define automate compliance checks and requirements.", "Define extract and validate document data via AI.", "Define integrate risk, AML, and sanctions screening.", "Define orchestrate approval workflows and system activation."], "priority": "medium", "project_context": "internal", "initiative_type": "new_product", "delivery_mode": "standard", "rnd_hypothesis": "", "rnd_experiment_goal": "", "rnd_success_criteria": "", "rnd_timebox_weeks": null, "rnd_decision_date": "", "rnd_next_gate": "", "rnd_risk_level": "", "accountable_person": "", "picked_up": false}	2026-02-09 04:57:18.30811
34	19	created_from_intake	1	["title", "scope", "activities", "priority", "project_context", "initiative_type", "delivery_mode", "rnd_hypothesis", "rnd_experiment_goal", "rnd_success_criteria", "rnd_decision_date", "rnd_next_gate", "rnd_risk_level", "accountable_person", "picked_up"]	{}	{"title": "Financial Document Processing Automation", "scope": "This covers ingesting, classifying, extracting, and verifying various financial documents from defined input sources for Z-TRANSACT.", "activities": ["Define ingest documents from specified sources", "Define auto-classify diverse financial document types", "Define extract required data fields from documents", "Define apply document-specific verification criteria", "Define process documents regardless of layout"], "priority": "high", "project_context": "internal", "initiative_type": "new_feature", "delivery_mode": "standard", "rnd_hypothesis": "", "rnd_experiment_goal": "", "rnd_success_criteria": "", "rnd_timebox_weeks": null, "rnd_decision_date": "", "rnd_next_gate": "", "rnd_risk_level": "", "accountable_person": "", "picked_up": false}	2026-02-09 12:02:12.757373
35	20	created_from_intake	1	["title", "scope", "activities", "priority", "project_context", "initiative_type", "delivery_mode", "rnd_hypothesis", "rnd_experiment_goal", "rnd_success_criteria", "rnd_decision_date", "rnd_next_gate", "rnd_risk_level", "accountable_person", "picked_up"]	{}	{"title": "Comprehensive Reconciliation Framework", "scope": "Encompasses bank, credit card, AP, AR, intercompany, payroll, expense, cash, inventory, and tax reconciliations.", "activities": ["Standardize data ingestion processes", "Define automate transaction matching logic", "Identify and categorize all discrepancies", "Define streamline discrepancy resolution workflows", "Define generate compliance and audit trails"], "priority": "high", "project_context": "internal", "initiative_type": "new_feature", "delivery_mode": "standard", "rnd_hypothesis": "", "rnd_experiment_goal": "", "rnd_success_criteria": "", "rnd_timebox_weeks": null, "rnd_decision_date": "", "rnd_next_gate": "", "rnd_risk_level": "", "accountable_person": "", "picked_up": false}	2026-02-09 12:09:01.751627
36	21	created_from_intake	1	["title", "scope", "activities", "priority", "project_context", "initiative_type", "delivery_mode", "rnd_hypothesis", "rnd_experiment_goal", "rnd_success_criteria", "rnd_decision_date", "rnd_next_gate", "rnd_risk_level", "accountable_person", "picked_up"]	{}	{"title": "Intelligent Financial Reconciliation Platform", "scope": "Automate high-frequency financial reconciliations with ML-driven insights and workflow actions.", "activities": ["Establish core reconciliation matching framework.", "Define develop ML models for match confidence and prediction.", "Implement prescriptive actions for reconciliation items.", "Define create interactive dashboards for reconciliation management.", "Define integrate with source systems for data ingestion."], "priority": "medium", "project_context": "internal", "initiative_type": "new_feature", "delivery_mode": "standard", "rnd_hypothesis": "", "rnd_experiment_goal": "", "rnd_success_criteria": "", "rnd_timebox_weeks": null, "rnd_decision_date": "", "rnd_next_gate": "", "rnd_risk_level": "", "accountable_person": "", "picked_up": false}	2026-02-09 12:13:40.127347
38	23	created_from_intake	1	["title", "scope", "activities", "priority", "project_context", "initiative_type", "delivery_mode", "rnd_hypothesis", "rnd_experiment_goal", "rnd_success_criteria", "rnd_decision_date", "rnd_next_gate", "rnd_risk_level", "accountable_person", "picked_up"]	{}	{"title": "104 HealthCare Helpline Modernization", "scope": "Implement the Z-Agent platform to unify and automate services for the Jharkhand 104 HealthCare Helpline, encompassing data integration, AI-driven citizen support, and operational dashboards.", "activities": ["Establish integrated health data warehouse", "Define deploy AI-powered citizen interaction agents", "Define integrate with external government health APIs", "Define provide real-time operational and governance dashboards"], "priority": "medium", "project_context": "internal", "initiative_type": "new_feature", "delivery_mode": "standard", "rnd_hypothesis": "", "rnd_experiment_goal": "", "rnd_success_criteria": "", "rnd_timebox_weeks": null, "rnd_decision_date": "", "rnd_next_gate": "", "rnd_risk_level": "", "accountable_person": "", "picked_up": false}	2026-02-09 12:24:19.793919
39	24	created_from_intake	1	["title", "scope", "activities", "priority", "project_context", "initiative_type", "delivery_mode", "rnd_hypothesis", "rnd_experiment_goal", "rnd_success_criteria", "rnd_decision_date", "rnd_next_gate", "rnd_risk_level", "accountable_person", "picked_up"]	{}	{"title": "HR Intelligence Assistant Program", "scope": "Establish a secure, AI-driven HR knowledge and skill intelligence system within a 90-day pilot.", "activities": ["Define ingest and digitize all HR records", "Define construct HR knowledge and skill graphs", "Implement AI-driven Q&A workflows", "Define ensure private, compliant data handling", "Define pilot with 1000 employee records"], "priority": "medium", "project_context": "internal", "initiative_type": "new_feature", "delivery_mode": "standard", "rnd_hypothesis": "", "rnd_experiment_goal": "", "rnd_success_criteria": "", "rnd_timebox_weeks": null, "rnd_decision_date": "", "rnd_next_gate": "", "rnd_risk_level": "", "accountable_person": "", "picked_up": false}	2026-02-09 12:25:52.287307
\.


--
-- Data for Name: roadmap_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.roadmap_items (id, title, scope, activities, source_document_id, created_from_intake_id, created_at, priority, project_context, initiative_type, accountable_person, picked_up, delivery_mode, rnd_hypothesis, rnd_experiment_goal, rnd_success_criteria, rnd_timebox_weeks, rnd_decision_date, rnd_next_gate, rnd_risk_level) FROM stdin;
23	104 HealthCare Helpline Modernization	Implement the Z-Agent platform to unify and automate services for the Jharkhand 104 HealthCare Helpline, encompassing data integration, AI-driven citizen support, and operational dashboards.	["Establish integrated health data warehouse", "Define deploy AI-powered citizen interaction agents", "Define integrate with external government health APIs", "Define provide real-time operational and governance dashboards"]	41	35	2026-02-09 12:24:19.788544	medium	internal	new_feature		f	standard				\N			
14	SmartDoc Document Intelligence Platform	Process unstructured documents from ingestion through intelligent extraction, confidence-based routing, and enterprise system integration.	["Define ingest documents from diverse sources.", "Define classify document types and intent.", "Define extract data with confidence scores.", "Define route outcomes based on confidence thresholds.", "Define integrate with core enterprise systems."]	27	24	2026-02-08 13:57:19.891425	medium	internal	new_product	Madhu	t	standard				\N			
16	Financial Services Provider Engagement	This covers the independent statutory audit and year-round tax and financial advisory for PBVFOWA for the Financial Year 2025-2026, with potential for split engagements.	["Define conduct statutory audit and financial reporting", "Define manage tax compliance and representation", "Define provide strategic financial advisory", "Define deliver independent audit reports and tax filings", "Define report bylaw non-compliance and recommend rectification"]	29	26	2026-02-09 04:55:56.702027	medium	client	new_feature	Madhu	t	rnd	Test	Test	Test	\N		pivot	low
17	Automated Vendor Onboarding Platform	• Country-specific tax and regulatory requirements GST, VAT, PAN, EIN, UEN, TRN—vendors are guided through only what applies to them, no more, no less.	["Implement secure vendor identity verification.", "Define automate compliance checks and requirements.", "Define extract and validate document data via AI.", "Define integrate risk, AML, and sanctions screening.", "Define orchestrate approval workflows and system activation."]	28	25	2026-02-09 04:57:18.30401	medium	internal	new_product		f	standard				\N			
19	Financial Document Processing Automation	This covers ingesting, classifying, extracting, and verifying various financial documents from defined input sources for Z-TRANSACT.	["Define ingest documents from specified sources", "Define auto-classify diverse financial document types", "Define extract required data fields from documents", "Define apply document-specific verification criteria", "Define process documents regardless of layout"]	73	30	2026-02-09 12:02:12.746395	high	internal	new_feature		f	standard				\N			
20	Comprehensive Reconciliation Framework	Encompasses bank, credit card, AP, AR, intercompany, payroll, expense, cash, inventory, and tax reconciliations.	["Standardize data ingestion processes", "Define automate transaction matching logic", "Identify and categorize all discrepancies", "Define streamline discrepancy resolution workflows", "Define generate compliance and audit trails"]	72	31	2026-02-09 12:09:01.739586	high	internal	new_feature		f	standard				\N			
21	Intelligent Financial Reconciliation Platform	Automate high-frequency financial reconciliations with ML-driven insights and workflow actions.	["Establish core reconciliation matching framework.", "Define develop ML models for match confidence and prediction.", "Implement prescriptive actions for reconciliation items.", "Define create interactive dashboards for reconciliation management.", "Define integrate with source systems for data ingestion."]	69	33	2026-02-09 12:13:40.120845	medium	internal	new_feature		f	standard				\N			
24	HR Intelligence Assistant Program	Establish a secure, AI-driven HR knowledge and skill intelligence system within a 90-day pilot.	["Define ingest and digitize all HR records", "Define construct HR knowledge and skill graphs", "Implement AI-driven Q&A workflows", "Define ensure private, compliant data handling", "Define pilot with 1000 employee records"]	55	36	2026-02-09 12:25:52.282204	medium	internal	new_feature		f	standard				\N			
\.


--
-- Data for Name: roadmap_plan_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.roadmap_plan_items (id, bucket_item_id, title, scope, activities, priority, project_context, initiative_type, entered_roadmap_at, tentative_duration_weeks, pickup_period, completion_period, created_at, accountable_person, delivery_mode, rnd_hypothesis, rnd_experiment_goal, rnd_success_criteria, rnd_timebox_weeks, rnd_decision_date, rnd_next_gate, rnd_risk_level, planned_start_date, planned_end_date, resource_count, effort_person_weeks, planning_status, confidence, dependency_ids) FROM stdin;
4	14	SmartDoc Document Intelligence Platform	Process unstructured documents from ingestion through intelligent extraction, confidence-based routing, and enterprise system integration.	["Define ingest documents from diverse sources.", "Define classify document types and intent.", "Define extract data with confidence scores.", "Define route outcomes based on confidence thresholds.", "Define integrate with core enterprise systems."]	medium	internal	new_product	2026-02-09 03:52:09.806341	\N	Near-term		2026-02-09 03:52:09.806344	Madhu	standard				\N						\N	\N	not_started	medium	[]
5	16	Financial Services Provider Engagement	This covers the independent statutory audit and year-round tax and financial advisory for PBVFOWA for the Financial Year 2025-2026, with potential for split engagements.	["Define conduct statutory audit and financial reporting", "Define manage tax compliance and representation", "Define provide strategic financial advisory", "Define deliver independent audit reports and tax filings", "Define report bylaw non-compliance and recommend rectification"]	medium	client	new_feature	2026-02-09 04:56:18.482716	\N	Long-term		2026-02-09 04:56:18.482725	Madhu	rnd	Test	Test	Test	\N		pivot	low	2026-06-01	2026-09-10	\N	\N	not_started	medium	[]
\.


--
-- Data for Name: roadmap_redundancy_decisions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.roadmap_redundancy_decisions (id, left_item_id, right_item_id, decision, decided_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, full_name, email, password_hash, role, created_at) FROM stdin;
1	CEO User	ceo@local.test	$pbkdf2-sha256$29000$xtgbw/hfS8lZS2ltbc35Hw$1sd3t8Zm11LyqoH78bF4OQbX97x/I11zlPOVTA9PkzE	CEO	2026-02-06 06:33:21.272166
2	VP User	vp@local.test	$pbkdf2-sha256$29000$.f./t9aak1JKybkXYgwBoA$o0Ziuvysq0Hm0VGStk0v.ZGHwWk5ldx4lSZ.tS4dqx0	VP	2026-02-06 06:33:21.272171
3	BA User	ba@local.test	$pbkdf2-sha256$29000$odSaU8qZszbG.P9f6z1HiA$MOYSfBKIntUhc71nrVhQqW37dweAqeaxoI5VCC4H.V4	BA	2026-02-06 06:33:21.272172
4	PM User	pm@local.test	$pbkdf2-sha256$29000$aY0R4jxnzFmrde79v/deiw$6rRf9gA7d6JdnwdD8XqEqAZWs4HmnVKCYixoc2Nytts	PM	2026-02-06 06:33:21.272172
\.


--
-- Name: documents_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.documents_id_seq', 74, true);


--
-- Name: features_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.features_id_seq', 1, false);


--
-- Name: intake_analyses_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.intake_analyses_id_seq', 27, true);


--
-- Name: intake_item_versions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.intake_item_versions_id_seq', 96, true);


--
-- Name: intake_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.intake_items_id_seq', 36, true);


--
-- Name: llm_configs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.llm_configs_id_seq', 7, true);


--
-- Name: projects_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.projects_id_seq', 1, false);


--
-- Name: roadmap_item_versions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.roadmap_item_versions_id_seq', 39, true);


--
-- Name: roadmap_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.roadmap_items_id_seq', 24, true);


--
-- Name: roadmap_plan_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.roadmap_plan_items_id_seq', 6, true);


--
-- Name: roadmap_redundancy_decisions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.roadmap_redundancy_decisions_id_seq', 1, false);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.users_id_seq', 4, true);


--
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- Name: features features_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.features
    ADD CONSTRAINT features_pkey PRIMARY KEY (id);


--
-- Name: intake_analyses intake_analyses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intake_analyses
    ADD CONSTRAINT intake_analyses_pkey PRIMARY KEY (id);


--
-- Name: intake_item_versions intake_item_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intake_item_versions
    ADD CONSTRAINT intake_item_versions_pkey PRIMARY KEY (id);


--
-- Name: intake_items intake_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intake_items
    ADD CONSTRAINT intake_items_pkey PRIMARY KEY (id);


--
-- Name: llm_configs llm_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.llm_configs
    ADD CONSTRAINT llm_configs_pkey PRIMARY KEY (id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: roadmap_item_versions roadmap_item_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roadmap_item_versions
    ADD CONSTRAINT roadmap_item_versions_pkey PRIMARY KEY (id);


--
-- Name: roadmap_items roadmap_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roadmap_items
    ADD CONSTRAINT roadmap_items_pkey PRIMARY KEY (id);


--
-- Name: roadmap_plan_items roadmap_plan_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roadmap_plan_items
    ADD CONSTRAINT roadmap_plan_items_pkey PRIMARY KEY (id);


--
-- Name: roadmap_redundancy_decisions roadmap_redundancy_decisions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roadmap_redundancy_decisions
    ADD CONSTRAINT roadmap_redundancy_decisions_pkey PRIMARY KEY (id);


--
-- Name: roadmap_redundancy_decisions uq_redundancy_pair; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roadmap_redundancy_decisions
    ADD CONSTRAINT uq_redundancy_pair UNIQUE (left_item_id, right_item_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: ix_documents_file_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_documents_file_hash ON public.documents USING btree (file_hash);


--
-- Name: ix_documents_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_documents_id ON public.documents USING btree (id);


--
-- Name: ix_documents_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_documents_project_id ON public.documents USING btree (project_id);


--
-- Name: ix_features_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_features_id ON public.features USING btree (id);


--
-- Name: ix_features_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_features_project_id ON public.features USING btree (project_id);


--
-- Name: ix_intake_analyses_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_intake_analyses_id ON public.intake_analyses USING btree (id);


--
-- Name: ix_intake_analyses_intake_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_intake_analyses_intake_item_id ON public.intake_analyses USING btree (intake_item_id);


--
-- Name: ix_intake_item_versions_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_intake_item_versions_id ON public.intake_item_versions USING btree (id);


--
-- Name: ix_intake_item_versions_intake_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_intake_item_versions_intake_item_id ON public.intake_item_versions USING btree (intake_item_id);


--
-- Name: ix_intake_items_document_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_intake_items_document_id ON public.intake_items USING btree (document_id);


--
-- Name: ix_intake_items_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_intake_items_id ON public.intake_items USING btree (id);


--
-- Name: ix_llm_configs_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_llm_configs_id ON public.llm_configs USING btree (id);


--
-- Name: ix_projects_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_projects_id ON public.projects USING btree (id);


--
-- Name: ix_redundancy_left_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_redundancy_left_item_id ON public.roadmap_redundancy_decisions USING btree (left_item_id);


--
-- Name: ix_redundancy_right_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_redundancy_right_item_id ON public.roadmap_redundancy_decisions USING btree (right_item_id);


--
-- Name: ix_roadmap_item_versions_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_roadmap_item_versions_id ON public.roadmap_item_versions USING btree (id);


--
-- Name: ix_roadmap_item_versions_roadmap_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_roadmap_item_versions_roadmap_item_id ON public.roadmap_item_versions USING btree (roadmap_item_id);


--
-- Name: ix_roadmap_items_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_roadmap_items_id ON public.roadmap_items USING btree (id);


--
-- Name: ix_roadmap_plan_items_bucket_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_roadmap_plan_items_bucket_item_id ON public.roadmap_plan_items USING btree (bucket_item_id);


--
-- Name: ix_roadmap_plan_items_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_roadmap_plan_items_id ON public.roadmap_plan_items USING btree (id);


--
-- Name: ix_roadmap_redundancy_decisions_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_roadmap_redundancy_decisions_id ON public.roadmap_redundancy_decisions USING btree (id);


--
-- Name: ix_roadmap_redundancy_decisions_left_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_roadmap_redundancy_decisions_left_item_id ON public.roadmap_redundancy_decisions USING btree (left_item_id);


--
-- Name: ix_roadmap_redundancy_decisions_right_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_roadmap_redundancy_decisions_right_item_id ON public.roadmap_redundancy_decisions USING btree (right_item_id);


--
-- Name: ix_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_users_email ON public.users USING btree (email);


--
-- Name: ix_users_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_users_id ON public.users USING btree (id);


--
-- Name: documents documents_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: documents documents_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- Name: features features_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.features
    ADD CONSTRAINT features_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: intake_analyses intake_analyses_intake_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intake_analyses
    ADD CONSTRAINT intake_analyses_intake_item_id_fkey FOREIGN KEY (intake_item_id) REFERENCES public.intake_items(id);


--
-- Name: intake_item_versions intake_item_versions_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intake_item_versions
    ADD CONSTRAINT intake_item_versions_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id);


--
-- Name: intake_item_versions intake_item_versions_intake_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intake_item_versions
    ADD CONSTRAINT intake_item_versions_intake_item_id_fkey FOREIGN KEY (intake_item_id) REFERENCES public.intake_items(id);


--
-- Name: intake_items intake_items_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intake_items
    ADD CONSTRAINT intake_items_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id);


--
-- Name: intake_items intake_items_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intake_items
    ADD CONSTRAINT intake_items_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id);


--
-- Name: intake_items intake_items_roadmap_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intake_items
    ADD CONSTRAINT intake_items_roadmap_item_id_fkey FOREIGN KEY (roadmap_item_id) REFERENCES public.roadmap_items(id);


--
-- Name: projects projects_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id);


--
-- Name: roadmap_item_versions roadmap_item_versions_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roadmap_item_versions
    ADD CONSTRAINT roadmap_item_versions_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id);


--
-- Name: roadmap_item_versions roadmap_item_versions_roadmap_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roadmap_item_versions
    ADD CONSTRAINT roadmap_item_versions_roadmap_item_id_fkey FOREIGN KEY (roadmap_item_id) REFERENCES public.roadmap_items(id);


--
-- Name: roadmap_items roadmap_items_source_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roadmap_items
    ADD CONSTRAINT roadmap_items_source_document_id_fkey FOREIGN KEY (source_document_id) REFERENCES public.documents(id);


--
-- Name: roadmap_plan_items roadmap_plan_items_bucket_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roadmap_plan_items
    ADD CONSTRAINT roadmap_plan_items_bucket_item_id_fkey FOREIGN KEY (bucket_item_id) REFERENCES public.roadmap_items(id);


--
-- Name: roadmap_redundancy_decisions roadmap_redundancy_decisions_decided_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roadmap_redundancy_decisions
    ADD CONSTRAINT roadmap_redundancy_decisions_decided_by_fkey FOREIGN KEY (decided_by) REFERENCES public.users(id);


--
-- Name: roadmap_redundancy_decisions roadmap_redundancy_decisions_left_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roadmap_redundancy_decisions
    ADD CONSTRAINT roadmap_redundancy_decisions_left_item_id_fkey FOREIGN KEY (left_item_id) REFERENCES public.roadmap_items(id);


--
-- Name: roadmap_redundancy_decisions roadmap_redundancy_decisions_right_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roadmap_redundancy_decisions
    ADD CONSTRAINT roadmap_redundancy_decisions_right_item_id_fkey FOREIGN KEY (right_item_id) REFERENCES public.roadmap_items(id);


--
-- PostgreSQL database dump complete
--

\unrestrict hDCsE5YBygYzzzrkoRtUY8hnpM7oFHqoEYMp5FhMNUEJbf3iFgeZasXfV5YiubT

