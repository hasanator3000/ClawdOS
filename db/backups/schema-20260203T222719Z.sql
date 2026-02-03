--
-- PostgreSQL database dump
--

\restrict m8kHIfohdsHNeewBZbHLIqTq0MCtsOCsSipIG0d1FUR0LHVkohQmcCoX7hom5zt

-- Dumped from database version 16.11 (Ubuntu 16.11-0ubuntu0.24.04.1)
-- Dumped by pg_dump version 16.11 (Ubuntu 16.11-0ubuntu0.24.04.1)

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
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: app_current_user_id(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.app_current_user_id() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  SELECT nullif(current_setting('app.user_id', true), '')::uuid;
$$;


ALTER FUNCTION public.app_current_user_id() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: app_user; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.app_user (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    username text NOT NULL,
    password_hash text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT app_user_username_check CHECK (((char_length(username) >= 3) AND (char_length(username) <= 32)))
);


ALTER TABLE public.app_user OWNER TO postgres;

--
-- Name: digest; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.digest (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    date date NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.digest OWNER TO postgres;

--
-- Name: news_item; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.news_item (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    topic text NOT NULL,
    title text NOT NULL,
    url text NOT NULL,
    summary text NOT NULL,
    published_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT news_item_topic_check CHECK ((topic = ANY (ARRAY['world'::text, 'ai'::text, 'other'::text])))
);


ALTER TABLE public.news_item OWNER TO postgres;

--
-- Name: workspace; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.workspace (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    kind text NOT NULL,
    owner_user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT workspace_kind_check CHECK ((kind = ANY (ARRAY['personal'::text, 'shared'::text])))
);


ALTER TABLE public.workspace OWNER TO postgres;

--
-- Name: workspace_member; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.workspace_member (
    workspace_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT workspace_member_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'member'::text])))
);


ALTER TABLE public.workspace_member OWNER TO postgres;

--
-- Name: app_user app_user_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.app_user
    ADD CONSTRAINT app_user_pkey PRIMARY KEY (id);


--
-- Name: app_user app_user_username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.app_user
    ADD CONSTRAINT app_user_username_key UNIQUE (username);


--
-- Name: digest digest_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.digest
    ADD CONSTRAINT digest_pkey PRIMARY KEY (id);


--
-- Name: digest digest_workspace_id_date_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.digest
    ADD CONSTRAINT digest_workspace_id_date_key UNIQUE (workspace_id, date);


--
-- Name: news_item news_item_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.news_item
    ADD CONSTRAINT news_item_pkey PRIMARY KEY (id);


--
-- Name: workspace_member workspace_member_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workspace_member
    ADD CONSTRAINT workspace_member_pkey PRIMARY KEY (workspace_id, user_id);


--
-- Name: workspace workspace_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workspace
    ADD CONSTRAINT workspace_pkey PRIMARY KEY (id);


--
-- Name: workspace workspace_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workspace
    ADD CONSTRAINT workspace_slug_key UNIQUE (slug);


--
-- Name: news_item_ws_topic_created_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX news_item_ws_topic_created_idx ON public.news_item USING btree (workspace_id, topic, created_at DESC);


--
-- Name: digest digest_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.digest
    ADD CONSTRAINT digest_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspace(id) ON DELETE CASCADE;


--
-- Name: news_item news_item_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.news_item
    ADD CONSTRAINT news_item_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspace(id) ON DELETE CASCADE;


--
-- Name: workspace_member workspace_member_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workspace_member
    ADD CONSTRAINT workspace_member_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.app_user(id) ON DELETE CASCADE;


--
-- Name: workspace_member workspace_member_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workspace_member
    ADD CONSTRAINT workspace_member_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspace(id) ON DELETE CASCADE;


--
-- Name: workspace workspace_owner_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workspace
    ADD CONSTRAINT workspace_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES public.app_user(id) ON DELETE SET NULL;


--
-- Name: digest; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.digest ENABLE ROW LEVEL SECURITY;

--
-- Name: digest digest_rw; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY digest_rw ON public.digest USING ((EXISTS ( SELECT 1
   FROM public.workspace_member m
  WHERE ((m.workspace_id = digest.workspace_id) AND (m.user_id = public.app_current_user_id()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.workspace_member m
  WHERE ((m.workspace_id = digest.workspace_id) AND (m.user_id = public.app_current_user_id())))));


--
-- Name: news_item; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.news_item ENABLE ROW LEVEL SECURITY;

--
-- Name: news_item news_item_rw; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY news_item_rw ON public.news_item USING ((EXISTS ( SELECT 1
   FROM public.workspace_member m
  WHERE ((m.workspace_id = news_item.workspace_id) AND (m.user_id = public.app_current_user_id()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.workspace_member m
  WHERE ((m.workspace_id = news_item.workspace_id) AND (m.user_id = public.app_current_user_id())))));


--
-- Name: workspace; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.workspace ENABLE ROW LEVEL SECURITY;

--
-- Name: workspace_member; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.workspace_member ENABLE ROW LEVEL SECURITY;

--
-- Name: workspace_member workspace_member_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY workspace_member_select ON public.workspace_member FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.workspace_member m
  WHERE ((m.workspace_id = workspace_member.workspace_id) AND (m.user_id = public.app_current_user_id())))));


--
-- Name: workspace workspace_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY workspace_select ON public.workspace FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.workspace_member m
  WHERE ((m.workspace_id = workspace.id) AND (m.user_id = public.app_current_user_id())))));


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA public TO lifeos;


--
-- Name: TABLE app_user; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.app_user TO lifeos;


--
-- Name: TABLE digest; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.digest TO lifeos;


--
-- Name: TABLE news_item; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.news_item TO lifeos;


--
-- Name: TABLE workspace; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.workspace TO lifeos;


--
-- Name: TABLE workspace_member; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.workspace_member TO lifeos;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES TO lifeos;


--
-- PostgreSQL database dump complete
--

\unrestrict m8kHIfohdsHNeewBZbHLIqTq0MCtsOCsSipIG0d1FUR0LHVkohQmcCoX7hom5zt

