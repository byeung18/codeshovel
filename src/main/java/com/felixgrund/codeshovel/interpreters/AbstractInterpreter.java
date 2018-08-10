package com.felixgrund.codeshovel.interpreters;

import com.felixgrund.codeshovel.entities.Ycommit;
import com.felixgrund.codeshovel.services.RepositoryService;
import com.felixgrund.codeshovel.changes.Ychange;
import com.felixgrund.codeshovel.parser.Yfunction;
import com.felixgrund.codeshovel.parser.Yparser;
import com.felixgrund.codeshovel.wrappers.StartEnvironment;
import com.felixgrund.codeshovel.util.CachingParserFactory;
import org.eclipse.jgit.lib.Repository;
import com.felixgrund.codeshovel.wrappers.Commit;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

public abstract class AbstractInterpreter {

	protected RepositoryService repositoryService;

	protected StartEnvironment startEnv;
	protected Ycommit ycommit;
	protected Repository repository;
	protected String repositoryName;

	protected abstract Ychange interpret() throws Exception;

	public AbstractInterpreter(StartEnvironment startEnv, Ycommit ycommit) {
		this.startEnv = startEnv;
		this.repository = startEnv.getRepository();
		this.repositoryName = startEnv.getRepositoryName();
		this.repositoryService = startEnv.getRepositoryService();
		this.ycommit = ycommit;
	}

	protected Yparser createParserForCommitAndFile(Commit commit, String filePath) throws Exception {
		Yparser ret = null;
		String fileContent = repositoryService.findFileContent(commit, filePath);
		if (fileContent != null) {
			ret = CachingParserFactory.getParser(this.startEnv, filePath, fileContent, commit);
		}
		return ret;
	}

	protected List<Yfunction> getRemovedFunctions(Commit commitNew, Commit commitOld, String oldFilePath, String newFilePath) throws Exception {
		List<Yfunction> ret = new ArrayList<>();
		Yparser parserOld = createParserForCommitAndFile(commitOld, oldFilePath);
		Yparser parserNew = createParserForCommitAndFile(commitNew, newFilePath);
		if (parserNew == null) {
			ret = parserOld.getAllFunctions();
		} else {
			Map<String, Yfunction> functionsNew = parserNew.getAllFunctionsAsMap();
			Map<String, Yfunction> functionsOld = parserOld.getAllFunctionsAsMap();
			Set<String> newFunctionIds = functionsNew.keySet();
			for (String functionId : functionsOld.keySet()) {
				if (!newFunctionIds.contains(functionId)) {
					ret.add(functionsOld.get(functionId));
				}
			}
		}

		return ret;
	}


}
