--
-- PostgreSQL database dump
--

\restrict d5b4zZ98877Qwac6Z0zmIs4AWV2U6oGcbKUaGMu79Vdipi0MtecKnFWFUOTolnF

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

\unrestrict d5b4zZ98877Qwac6Z0zmIs4AWV2U6oGcbKUaGMu79Vdipi0MtecKnFWFUOTolnF

