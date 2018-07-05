package com.felixgrund.codestory.ast.parser;

import com.felixgrund.codestory.ast.entities.*;

import java.util.List;

public interface Yfunction {

	String getBody();
	String getName();
	List<Yparameter> getParameters();
	Yreturn getReturnStmt();
	Ymodifiers getModifiers();
	Yexceptions getExceptions();
	int getNameLineNumber();
	int getEndLineNumber();
	Object getRawFunction();

	String getCommitName();
	String getCommitNameShort();

	String getId();

	String getSourceFileContent();
	String getSourceFilePath();

}
